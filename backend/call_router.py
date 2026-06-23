import asyncio
from sqlalchemy.orm import Session
from database import Device, get_utcnow
from ws_server import control_server

class BoxphoneCallRouter:
    def __init__(self):
        # Lưu trữ các S9AudioSession đang chạy: device_id -> S9AudioSession
        self.active_audio_sessions = {}

    def get_devices(self, db: Session):
        """Lấy danh sách tất cả thiết bị từ database"""
        return db.query(Device).all()

    def update_device_status(self, db: Session, device_id: str, status: str, ip_address: str = None):
        """Cập nhật trạng thái của thiết bị vào database"""
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            device = Device(id=device_id)
            db.add(device)
        
        device.status = status
        if ip_address:
            device.ip_address = ip_address
        device.updated_at = get_utcnow()
        db.commit()
        print(f"[Call Router] Đã cập nhật database cho {device_id}: {status}")

    def allocate_device(self, db: Session) -> Device:
        """
        Tìm và chiếm dụng một thiết bị đang rảnh ('idle') để thực hiện cuộc gọi.
        Trả về đối tượng Device hoặc None nếu không có máy rảnh.
        """
        device = db.query(Device).filter(Device.status == "idle").first()
        if device:
            device.status = "busy"
            device.updated_at = get_utcnow()
            db.commit()
            print(f"[Call Router] Đã cấp phát thiết bị: {device.id}")
            return device
        return None

    def release_device(self, db: Session, device_id: str):
        """Giải phóng thiết bị về trạng thái rảnh ('idle')"""
        device = db.query(Device).filter(Device.id == device_id).first()
        if device:
            device.status = "idle"
            device.updated_at = get_utcnow()
            db.commit()
            print(f"[Call Router] Đã giải phóng thiết bị: {device_id}")

    async def dial_number(self, db: Session, phone_number: str) -> bool:
        """
        Thực hiện cuộc gọi đi: Tìm máy rảnh, gửi lệnh quay số qua WebSocket.
        """
        device = self.allocate_device(db)
        if not device:
            print("[Call Router] Không thực hiện được cuộc gọi: Không có thiết bị Samsung S9 nào rảnh.")
            return False

        # Gửi lệnh quay số tới thiết bị được chọn
        success = await control_server.send_command(
            device_id=device.id,
            command="DIAL",
            payload={"phone_number": phone_number}
        )

        if not success:
            # Nếu gửi lệnh thất bại, giải phóng thiết bị ngay lập tức
            self.release_device(db, device.id)
            return False
            
        return True

# Instance toàn cục để import và sử dụng dễ dàng
call_router = BoxphoneCallRouter()
