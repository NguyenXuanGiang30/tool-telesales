import asyncio
import json
import websockets
from database import SessionLocal

class DeviceWSConnection:
    def __init__(self, device_id, websocket):
        self.device_id = device_id
        self.websocket = websocket
        self.status = "idle"  # idle, busy, offline

class BoxphoneControlServer:
    def __init__(self, host="0.0.0.0", port=8010):
        self.host = host
        self.port = port
        self.active_connections = {}  # device_id -> DeviceWSConnection
        self.server = None

    async def register_device(self, device_id, websocket):
        conn = DeviceWSConnection(device_id, websocket)
        self.active_connections[device_id] = conn
        print(f"[WS Control] Thiết bị '{device_id}' đã kết nối và đăng ký thành công.")
        
        # Cập nhật trạng thái database
        from call_router import call_router
        db = SessionLocal()
        try:
            ip = websocket.remote_address[0] if websocket.remote_address else "127.0.0.1"
            call_router.update_device_status(db, device_id, "idle", ip_address=ip)
        finally:
            db.close()
        
        # Gửi phản hồi chào mừng
        await websocket.send(json.dumps({
            "type": "system",
            "message": f"Đăng ký thiết bị {device_id} thành công trên Control Server."
        }))

    async def unregister_device(self, device_id):
        if device_id in self.active_connections:
            del self.active_connections[device_id]
            print(f"[WS Control] Thiết bị '{device_id}' đã ngắt kết nối.")
            
            # Cập nhật trạng thái database
            from call_router import call_router
            db = SessionLocal()
            try:
                call_router.update_device_status(db, device_id, "offline")
            finally:
                db.close()

    async def handle_connection(self, websocket, path=None):
        device_id = None
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    print(f"[WS Control] Nhận bản tin không hợp lệ: {message}")
                    continue

                msg_type = data.get("type")
                
                if msg_type == "register":
                    device_id = data.get("device_id")
                    if device_id:
                        await self.register_device(device_id, websocket)
                    else:
                        await websocket.send(json.dumps({"type": "error", "message": "Thiếu device_id"}))
                
                elif msg_type == "status_update":
                    if device_id:
                        status = data.get("status")
                        if device_id in self.active_connections:
                            self.active_connections[device_id].status = status
                        
                        # Cập nhật database
                        from call_router import call_router
                        db = SessionLocal()
                        try:
                            call_router.update_device_status(db, device_id, status)
                        finally:
                            db.close()
                        print(f"[WS Control] Trạng thái {device_id} cập nhật: {status}")
                
                else:
                    print(f"[WS Control] Nhận lệnh từ {device_id or 'Unknown'}: {data}")

        except websockets.exceptions.ConnectionClosedError:
            pass
        finally:
            if device_id:
                await self.unregister_device(device_id)

    async def send_command(self, device_id, command, payload=None):
        if payload is None:
            payload = {}
        if device_id in self.active_connections:
            conn = self.active_connections[device_id]
            message = json.dumps({
                "command": command,
                **payload
            })
            await conn.websocket.send(message)
            print(f"[WS Control] Đã gửi lệnh {command} tới {device_id}")
            return True
        else:
            print(f"[WS Control] Lỗi: Không tìm thấy thiết bị '{device_id}' hoạt động.")
            return False

    async def start(self):
        print(f"[WS Control] Khởi tạo WebSocket Control Server tại {self.host}:{self.port}...")
        self.server = await websockets.serve(self.handle_connection, self.host, self.port)

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            print("[WS Control] Đã tắt WebSocket Control Server.")

# Instance toàn cục để import và sử dụng dễ dàng
control_server = BoxphoneControlServer()
