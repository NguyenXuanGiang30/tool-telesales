import sys
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import os
import time
import io
import wave
import json
import asyncio
import numpy as np
import psutil
import subprocess
from datetime import datetime
from typing import Optional, Union
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException
from gsm_module import ModernGsmModem, list_ports

from database import init_db, get_db, Campaign, Contact, CallLog, Setting, User, FlowData

# --- THÊM IMPORT ĐIỀU KHIỂN BOXPHONE ---
from ws_server import control_server
from audio_receiver import UDPAudioReceiver

# --- CÁC THƯ VIỆN AI THỰC TẾ ---
import torch
import torchaudio
import webrtcvad
from faster_whisper import WhisperModel
from transformers import AutoModelForCausalLM, AutoTokenizer

device = "cuda" if torch.cuda.is_available() else "cpu"
whisper_model = None
tokenizer = None
llm_model = None

def load_ai_models():
    global whisper_model, tokenizer, llm_model
    print(f"========== KHỞI ĐỘNG HỆ THỐNG AI TẠI {device.upper()} ==========")
    try:
        print("[1/2] Đang tải mô hình Faster-Whisper (tiny)...")
        whisper_model = WhisperModel("tiny", device=device, compute_type="float16" if device=="cuda" else "int8")
    except Exception as e:
        print(f"Lỗi tải Whisper: {e}")
        whisper_model = None

    try:
        print("[2/2] Đang tải mô hình Google Gemma-2...")
        model_id = "google/gemma-2-2b-it" 
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        llm_model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto"
        )
    except Exception as e:
        print(f"Lỗi tải Gemma: {e}")
        tokenizer = None
        llm_model = None

s9_sessions = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo bảng CSDL khi khởi động Server
    init_db()
    
    # Khởi động WebSocket Control Server
    await control_server.start()
    
    # Khởi động các cổng nghe UDP cho tối đa 5 máy S9 (S9_01 -> S9_05) trên cổng 50001 -> 50005
    for i in range(1, 6):
        device_id = f"S9_{i:02d}"
        port = 50000 + i
        session = S9AudioSession(device_id, port)
        session.start()
        s9_sessions[device_id] = session
        print(f"[Lifespan] Đã kích hoạt cổng nghe âm thanh {device_id} tại UDP {port}")

    # Khởi tạo AI models bất đồng bộ để tránh block uvicorn startup
    await asyncio.to_thread(load_ai_models)
    yield
    
    # Dọn dẹp khi tắt Server
    await control_server.stop()
    for session in s9_sessions.values():
        session.stop()

app = FastAPI(
    title="AutoCall AI Backend", 
    description="Backend xử lý suy luận Deep Learning & Database Local cho AutoCall",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- KHỞI TẠO AI MODELS GLOBALS ---
# Đã chuyển vào load_ai_models() để tránh block

# Đã tháo bỏ TTS theo yêu cầu của user

# Khởi tạo VAD
vad = webrtcvad.Vad(3) # Mức độ lọc nhiễu mạnh nhất (0-3)

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "message": "AI Backend đã gỡ bỏ TTS, chạy cơ chế Phát file ghi âm có sẵn.",
        "gpu_available": torch.cuda.is_available()
    }

@app.get("/api/hardware")
def hardware_stats():
    ram = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=0.1)
    gpu_name, gpu_vram_total_gb, gpu_vram_used_gb, gpu_percent = "No GPU Detected", 0.0, 0.0, 0.0
    
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        gpu_vram_total_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        gpu_vram_used_gb = torch.cuda.memory_allocated(0) / (1024**3)
        
    return {
        "cpu": cpu_percent,
        "ram": {"total": round(ram.total / (1024**3), 1), "used": round(ram.used / (1024**3), 1), "percent": ram.percent},
        "gpu": {"name": gpu_name, "vram_total": round(gpu_vram_total_gb, 1), "vram_used": round(gpu_vram_used_gb, 1), "percent": gpu_percent}
    }

# =======================================================
# CÁC HÀM XỬ LÝ AI BẤT ĐỒNG BỘ 
# =======================================================
def run_whisper(audio_bytes):
    if not whisper_model: return ""
    audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    segments, _ = whisper_model.transcribe(audio_np, beam_size=5, language="vi")
    return "".join([s.text for s in segments]).strip()

def run_gemma(user_text):
    """
    Gemma giờ đây chỉ trả về MÃ KỊCH BẢN (Intent Code) thay vì câu văn dài.
    Ví dụ: LAI_SUAT, CHAO_HOI, TU_CHOI, FORWARD...
    """
    if not llm_model or not tokenizer: return "DEFAULT"
    
    prompt = f"""<bos><start_of_turn>user
Nhiệm vụ: Phân tích câu nói của khách hàng và chỉ trả về DUY NHẤT 1 MÃ (ID) tương ứng để hệ thống bật file ghi âm.
Các mã cho phép:
- CHAO_HOI (Khách nói alo, xin chào)
- LAI_SUAT (Khách hỏi về lãi suất vay)
- THE_CHAP (Khách hỏi về tài sản thế chấp)
- TU_CHOI (Khách bảo không có nhu cầu, không rảnh)
- FORWARD (Khách đòi gặp nhân viên)
- KHONG_HIEU (Các trường hợp khác)

Khách nói: "{user_text}"
Chỉ in ra đúng 1 MÃ:
<end_of_turn>
<start_of_turn>model
"""
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = llm_model.generate(**inputs, max_new_tokens=10)
    
    intent_code = tokenizer.decode(outputs[0], skip_special_tokens=True).split("model\n")[-1].strip()
    return intent_code

def get_prerecorded_audio(intent_code):
    """
    Đọc file .wav được thu âm sẵn từ thư mục audio_files dựa trên mã Intent.
    """
    # Thư mục lưu các file ghi âm có sẵn
    audio_dir = "audio_files"
    os.makedirs(audio_dir, exist_ok=True)
    
    # Map intent tới tên file
    file_map = {
        "CHAO_HOI": "chao_hoi.wav",
        "LAI_SUAT": "lai_suat.wav",
        "THE_CHAP": "the_chap.wav",
        "TU_CHOI": "tu_choi.wav",
        "FORWARD": "chuyen_tiep.wav",
        "KHONG_HIEU": "khong_hieu.wav",
        "DEFAULT": "default.wav"
    }
    
    file_name = file_map.get(intent_code, "khong_hieu.wav")
    file_path = os.path.join(audio_dir, file_name)
    
    # Trả về chuỗi PCM giả nếu chưa có file thật
    if not os.path.exists(file_path):
        print(f"[CẢNH BÁO] Chưa có file ghi âm sẵn: {file_path}")
        return b'\x00' * 32000 # 1 giây im lặng (16000 mẫu * 2 bytes/mẫu)
        
    try:
        # Giả định file lưu chuẩn PCM 16-bit 16kHz Mono
        with wave.open(file_path, 'rb') as wf:
            return wf.readframes(wf.getnframes())
    except Exception as e:
        print(f"Lỗi đọc file wav: {e}")
        return b'\x00' * 16000


# =======================================================
# LỚP XỬ LÝ ÂM THANH CÔ LẬP CHO TỪNG MÁY S9 (SESSION ISOLATION)
# =======================================================
class S9AudioSession:
    def __init__(self, device_id: str, port: int):
        self.device_id = device_id
        self.port = port
        self.receiver = UDPAudioReceiver(port=port)
        self.audio_buffer = bytearray()
        self.voice_buffer = bytearray()
        self.silence_frames = 0
        self.is_talking = False
        
        # Các hằng số âm thanh cho từng máy S9
        self.SAMPLE_RATE = 16000
        self.FRAME_SIZE = 960  # 30ms ở 16kHz
        self.SILENCE_THRESHOLD_FRAMES = 26  # ~780ms im lặng
        self.MAX_BUFFER_BYTES = self.SAMPLE_RATE * 2 * 15  # Tối đa 15 giây đàm thoại

    def start(self):
        """Bắt đầu lắng nghe và gán callback luồng âm thanh"""
        self.receiver.start(self.process_audio_chunk)

    def stop(self):
        """Dừng lắng nghe và đóng socket"""
        self.receiver.stop()

    def process_audio_chunk(self, data: bytes):
        """Callback chạy dưới thread UDP để đẩy chunk vào buffer"""
        self.audio_buffer.extend(data)
        # Đẩy việc xử lý khung VAD về Asyncio Loop chính để tránh xung đột luồng
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(self.handle_audio_frames(), loop)

    async def handle_audio_frames(self):
        """Xử lý phân tách khung và chạy thuật toán VAD cô lập"""
        while len(self.audio_buffer) >= self.FRAME_SIZE:
            frame = bytes(self.audio_buffer[:self.FRAME_SIZE])
            del self.audio_buffer[:self.FRAME_SIZE]
            
            try:
                is_speech = vad.is_speech(frame, self.SAMPLE_RATE)
            except Exception:
                is_speech = False
                
            if is_speech:
                if not self.is_talking:
                    self.is_talking = True
                    print(f"[{self.device_id}] Bắt đầu phát hiện giọng nói (USER_SPEAKING).")
                    self.voice_buffer.clear()
                
                self.silence_frames = 0
                self.voice_buffer.extend(frame)
            else:
                if self.is_talking:
                    self.silence_frames += 1
                    self.voice_buffer.extend(frame)
                    
            # Khi phát hiện người dùng dừng nói hoặc nói quá 15 giây
            if self.is_talking and (self.silence_frames > self.SILENCE_THRESHOLD_FRAMES or len(self.voice_buffer) > self.MAX_BUFFER_BYTES):
                self.is_talking = False
                self.silence_frames = 0
                print(f"[{self.device_id}] Đang xử lý hội thoại (THINKING)...")
                await self.process_voice_turn_s9()

    async def process_voice_turn_s9(self):
        """Xử lý lượt hội thoại của S9: dịch văn bản, sinh intent, gửi trả file âm thanh"""
        audio_bytes = bytes(self.voice_buffer)
        self.voice_buffer.clear()
        
        # 1. STT Whisper
        user_text = await asyncio.to_thread(run_whisper, audio_bytes)
        print(f"[{self.device_id} STT]: {user_text}")
        
        if not user_text:
            return
            
        # 2. Phân loại Ý định bằng Gemma-2
        intent_code = await asyncio.to_thread(run_gemma, user_text)
        print(f"[{self.device_id} Intent]: {intent_code}")
        
        # 3. Lấy file ghi âm phản hồi
        wav_pcm = await asyncio.to_thread(get_prerecorded_audio, intent_code)
        
        # 4. Truyền tải âm thanh phản hồi qua UDP về S9 (Streaming gối đầu mỗi 20ms)
        print(f"[{self.device_id}] Phát lại âm thanh phản hồi ({len(wav_pcm)} bytes) về UDP port {self.port}...")
        chunk_size = 640  # 20ms chunk ở tần số 16kHz
        for i in range(0, len(wav_pcm), chunk_size):
            chunk = wav_pcm[i:i+chunk_size]
            self.receiver.send_audio(chunk)
            await asyncio.sleep(0.02)
        print(f"[{self.device_id}] Đã hoàn thành phát âm thanh phản hồi.")


# =======================================================
# REST API CHO REACT FRONTEND (THAY THẾ FIREBASE)
# =======================================================
api_router = APIRouter(prefix="/api/v1")

class CampaignPayload(BaseModel):
    name: str
    status: str = "paused"
    progress: int = 0
    total: int = 0
    script: str = "Chua cau hinh"
    type: str = "callbot"
    user_id: Optional[str] = None


class CampaignPatchPayload(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    total: Optional[int] = None
    script: Optional[str] = None
    type: Optional[str] = None


class ContactPayload(BaseModel):
    campaign_id: Optional[str] = None
    name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[Union[list[str], str]] = None
    last_call: str = "-"
    status: str = "pending"


class FlowPayload(BaseModel):
    nodes: str = "[]"
    edges: str = "[]"


class GsmTestPayload(BaseModel):
    port: str
    baud_rate: int = 115200


def serialize_dt(value):
    return value.isoformat() if value else None


def campaign_to_dict(campaign: Campaign):
    return {
        "id": campaign.id,
        "user_id": campaign.user_id,
        "name": campaign.name,
        "status": campaign.status,
        "progress": campaign.progress,
        "total": campaign.total,
        "script": campaign.script,
        "type": campaign.type,
        "created_at": serialize_dt(campaign.created_at),
        "updated_at": serialize_dt(campaign.updated_at),
    }


def contact_to_dict(contact: Contact):
    return {
        "id": contact.id,
        "campaign_id": contact.campaign_id,
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "source": contact.source,
        "tags": contact.tags,
        "last_call": contact.last_call,
        "status": contact.status,
        "created_at": serialize_dt(contact.created_at),
    }

def calllog_to_dict(log: CallLog):
    return {
        "id": log.id,
        "contact_id": log.contact_id,
        "phone": log.phone,
        "customer_name": log.customer_name,
        "status": log.status,
        "duration": log.duration,
        "intent_code": log.intent_code,
        "transcript": log.transcript,
        "audio_path": log.audio_path,
        "created_at": serialize_dt(log.created_at),
    }

def setting_to_dict(setting: Setting):
    return {
        "key": setting.key,
        "value": setting.value,
    }


@api_router.get("/campaigns")
def get_campaigns(type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Campaign)
    if type:
        q = q.filter(Campaign.type == type)
    return [campaign_to_dict(c) for c in q.order_by(Campaign.created_at.desc()).all()]

@api_router.post("/campaigns")
def create_campaign(camp_data: CampaignPayload, db: Session = Depends(get_db)):
    new_camp = Campaign(**camp_data.model_dump())
    db.add(new_camp)
    db.commit()
    db.refresh(new_camp)
    return campaign_to_dict(new_camp)


@api_router.patch("/campaigns/{campaign_id}")
def update_campaign(campaign_id: str, camp_data: CampaignPatchPayload, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for key, value in camp_data.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    return campaign_to_dict(campaign)


@api_router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.query(FlowData).filter(FlowData.campaign_id == campaign_id).delete()
    db.query(Contact).filter(Contact.campaign_id == campaign_id).update({Contact.campaign_id: None})
    db.delete(campaign)
    db.commit()
    return {"ok": True}


@api_router.get("/campaigns/{campaign_id}/flow")
def get_campaign_flow(campaign_id: str, db: Session = Depends(get_db)):
    flow = db.query(FlowData).filter(FlowData.campaign_id == campaign_id).first()
    if not flow:
        return {"campaign_id": campaign_id, "nodes": "[]", "edges": "[]"}
    return {
        "campaign_id": flow.campaign_id,
        "nodes": flow.nodes,
        "edges": flow.edges,
        "created_at": serialize_dt(flow.created_at),
        "updated_at": serialize_dt(flow.updated_at),
    }


@api_router.put("/campaigns/{campaign_id}/flow")
def save_campaign_flow(campaign_id: str, flow_data: FlowPayload, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    flow = db.query(FlowData).filter(FlowData.campaign_id == campaign_id).first()
    if flow:
        flow.nodes = flow_data.nodes
        flow.edges = flow_data.edges
        flow.updated_at = datetime.utcnow()
    else:
        flow = FlowData(campaign_id=campaign_id, nodes=flow_data.nodes, edges=flow_data.edges)
        db.add(flow)
    campaign.updated_at = datetime.utcnow()
    db.commit()
    return {"campaign_id": campaign_id, "nodes": flow_data.nodes, "edges": flow_data.edges}

@api_router.get("/contacts")
def get_contacts(db: Session = Depends(get_db)):
    return [contact_to_dict(c) for c in db.query(Contact).order_by(Contact.created_at.desc()).all()]

@api_router.post("/contacts/batch")
def add_contacts(contacts_data: list[ContactPayload], db: Session = Depends(get_db)):
    new_contacts = []
    campaign_ids = set()
    for payload in contacts_data:
        data = payload.model_dump()
        tags = data.get("tags")
        if isinstance(tags, list):
            data["tags"] = json.dumps(tags, ensure_ascii=False)
        if data.get("campaign_id"):
            campaign_ids.add(data["campaign_id"])
        new_contacts.append(Contact(**data))

    db.add_all(new_contacts)
    db.flush() # Bắt buộc flush để tính đúng count
    for campaign_id in campaign_ids:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.total = db.query(Contact).filter(Contact.campaign_id == campaign_id).count()
            campaign.updated_at = datetime.utcnow()

    db.commit()
    return {"message": f"Đã thêm {len(new_contacts)} liên hệ", "count": len(new_contacts)}

@api_router.get("/call-logs")
def get_call_logs(db: Session = Depends(get_db)):
    return [calllog_to_dict(c) for c in db.query(CallLog).order_by(CallLog.created_at.desc()).all()]

@api_router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return [setting_to_dict(s) for s in db.query(Setting).all()]

@api_router.get("/gsm/ports")
def get_gsm_ports():
    if list_ports is None:
        return []
    ports = []
    for port in list_ports.comports():
        ports.append({
            "device": port.device,
            "description": port.description
        })
    return ports

@api_router.post("/gsm/test")
def test_gsm_connection(payload: GsmTestPayload):
    modem = ModernGsmModem()
    try:
        modem.connect(payload.port, payload.baud_rate)
        info = modem.get_device_info()
        modem.disconnect()
        return {"ok": True, "info": info}
    except Exception as e:
        if modem:
            modem.disconnect()
        raise HTTPException(status_code=400, detail=str(e))


# =======================================================
# API ĐIỀU KHIỂN CUỘC GỌI BOXPHONE CHO FRONTEND
# =======================================================
class DialRequest(BaseModel):
    phone_number: str

class ReleaseRequest(BaseModel):
    device_id: str

@api_router.post("/calls/dial")
async def call_dial(payload: DialRequest, db: Session = Depends(get_db)):
    from call_router import call_router
    success = await call_router.dial_number(db, payload.phone_number)
    if success:
        return {"status": "success", "message": f"Đang quay số tới {payload.phone_number}"}
    else:
        raise HTTPException(status_code=400, detail="Không có thiết bị S9 nào rảnh hoặc lỗi gửi lệnh.")

@api_router.post("/calls/release")
def call_release(payload: ReleaseRequest, db: Session = Depends(get_db)):
    from call_router import call_router
    call_router.release_device(db, payload.device_id)
    return {"status": "success", "message": f"Đã giải phóng thiết bị {payload.device_id}"}

@api_router.get("/devices")
def get_devices(db: Session = Depends(get_db)):
    from call_router import call_router
    devices = call_router.get_devices(db)
    return [{
        "id": d.id, 
        "ip_address": d.ip_address, 
        "status": d.status, 
        "updated_at": d.updated_at.isoformat() if d.updated_at else None
    } for d in devices]


app.include_router(api_router)

# =======================================================
# HÀM TIỆN ÍCH CHO WEBSOCKET
# =======================================================
async def send_ws_json(websocket: WebSocket, msg_type: str, payload_key: str, payload_value: str):
    """Helper gửi tin nhắn JSON gọn nhẹ qua WebSocket"""
    await websocket.send_text(json.dumps({"type": msg_type, payload_key: payload_value}))

async def process_voice_turn(websocket: WebSocket, voice_buffer: bytearray) -> bool:
    """
    Xử lý một lượt hội thoại AI (STT -> Intent -> Audio).
    Trả về True nếu tiếp tục cuộc gọi, False nếu cần dập máy/chuyển tiếp.
    """
    # 1. STT Bất đồng bộ
    audio_bytes = bytes(voice_buffer)
    voice_buffer.clear() # Clear ngay lập tức để tránh race condition
    
    user_text = await asyncio.to_thread(run_whisper, audio_bytes)
    print(f"[STT User]: {user_text}")
    await send_ws_json(websocket, "transcript", "text", user_text)
    
    if not user_text:
        return True # Không nghe thấy gì, tiếp tục lắng nghe
        
    # Phát hiện Voicemail
    voicemail_keywords = ["thuê bao", "hộp thư thoại", "để lại tin nhắn", "tiếng bíp"]
    if any(kw in user_text.lower() for kw in voicemail_keywords):
        print("[AMD] Đã phát hiện Voicemail! Dập máy.")
        await send_ws_json(websocket, "command", "action", "hangup_voicemail")
        return False
    
    # 2. LLM trả về Mã ID kịch bản
    intent_code = await asyncio.to_thread(run_gemma, user_text)
    print(f"[LLM Intent]: {intent_code}")
    await send_ws_json(websocket, "intent", "text", f"Mã kịch bản: {intent_code}")
    await send_ws_json(websocket, "status", "text", "SPEAKING")
    
    is_forwarding = "FORWARD" in intent_code
    
    # 3. Đọc và gửi luồng file ghi âm PCM
    wav_pcm = await asyncio.to_thread(get_prerecorded_audio, intent_code)
    await websocket.send_bytes(wav_pcm)
    
    if is_forwarding:
        print("[FORWARD] Đang chuyển tiếp cuộc gọi tới nhân viên!")
        await send_ws_json(websocket, "command", "action", "forward_call")
        return False
        
    await send_ws_json(websocket, "status", "text", "LISTENING")
    return True

# =======================================================
# WEBSOCKET ENDPOINT
# =======================================================
@app.websocket("/ws/voice-agent")
async def websocket_voice_agent(websocket: WebSocket):
    await websocket.accept()
    await send_ws_json(websocket, "system", "text", "Đã kết nối AI Server (Chế độ Audio Ghi âm sẵn).")
    
    audio_buffer = bytearray()
    voice_buffer = bytearray() 
    silence_frames = 0
    is_talking = False
    
    # --- Các hằng số cấu hình Audio/VAD ---
    SAMPLE_RATE = 16000
    FRAME_SIZE = 960 # 30ms ở 16kHz 16-bit
    SILENCE_THRESHOLD_FRAMES = 26 # Khoảng ~780ms im lặng
    MAX_BUFFER_BYTES = SAMPLE_RATE * 2 * 15 # 15 giây dung lượng âm thanh tối đa
    
    try:
        while True:
            data = await websocket.receive_bytes()
            audio_buffer.extend(data)
            
            while len(audio_buffer) >= FRAME_SIZE:
                frame = bytes(audio_buffer[:FRAME_SIZE])
                audio_buffer = audio_buffer[FRAME_SIZE:]
                
                try:
                    is_speech = vad.is_speech(frame, SAMPLE_RATE)
                except Exception:
                    is_speech = False
                    
                if is_speech:
                    if not is_talking:
                        is_talking = True
                        await send_ws_json(websocket, "status", "text", "USER_SPEAKING")
                        voice_buffer.clear()
                    
                    silence_frames = 0
                    voice_buffer.extend(frame)
                else:
                    if is_talking:
                        silence_frames += 1
                        voice_buffer.extend(frame)
                        
                # Xử lý khi kết thúc câu (đủ khoảng lặng) HOẶC nói quá dài (> 15s)
                if is_talking and (silence_frames > SILENCE_THRESHOLD_FRAMES or len(voice_buffer) > MAX_BUFFER_BYTES):
                    is_talking = False
                    silence_frames = 0
                    await send_ws_json(websocket, "status", "text", "THINKING")
                    
                    # Gọi hàm xử lý AI đã tách riêng
                    should_continue = await process_voice_turn(websocket, voice_buffer)
                    if not should_continue:
                        return

    except WebSocketDisconnect:
        print("[-] Client WebSocket đã ngắt kết nối")
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
