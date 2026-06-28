import socket
import asyncio

class UDPAudioReceiver:
    def __init__(self, host="0.0.0.0", port=50001):
        self.host = host
        self.port = port
        self.sock = None
        self.client_address = None
        self.is_running = False

    def start(self, callback_func):
        """
        Bắt đầu nhận âm thanh bằng cách mở socket UDP.
        callback_func nhận một đối số: bytes (dữ liệu PCM thô)
        """
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Cho phép reuse address để tránh lỗi Address already in use
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((self.host, self.port))
        self.is_running = True
        print(f"[UDP Audio] Lắng nghe luồng âm thanh tại {self.host}:{self.port}")

        # Chạy vòng lặp nhận dữ liệu trong luồng chạy ngầm của asyncio
        loop = asyncio.get_event_loop()
        loop.create_task(self._listen_loop(callback_func))

    async def _listen_loop(self, callback_func):
        loop = asyncio.get_event_loop()
        while self.is_running:
            try:
                # Chạy socket recvfrom bất đồng bộ để tránh block event loop
                data, addr = await loop.run_in_executor(None, self.sock.recvfrom, 1024)
                if not self.client_address or self.client_address != addr:
                    self.client_address = addr
                    print(f"[UDP Audio] Thiết bị đã gửi âm thanh từ địa chỉ: {addr}")
                
                # Gọi callback xử lý dữ liệu PCM nhận được
                if callback_func:
                    if asyncio.iscoroutinefunction(callback_func):
                        await callback_func(data)
                    else:
                        callback_func(data)
            except Exception as e:
                if self.is_running:
                    print(f"[UDP Audio] Lỗi trong loop nhận: {e}")
                await asyncio.sleep(0.01)

    def send_audio(self, pcm_data: bytes):
        """
        Gửi dữ liệu PCM từ PC về S9 (phát vào cuộc gọi cho khách hàng nghe)
        """
        if self.sock and self.client_address:
            try:
                self.sock.sendto(pcm_data, self.client_address)
            except Exception as e:
                print(f"[UDP Audio] Lỗi gửi âm thanh: {e}")
        else:
            # Nếu chưa có địa chỉ client (chưa nhận được packet nào từ S9), bỏ qua hoặc log cảnh báo
            pass

    def stop(self):
        self.is_running = False
        if self.sock:
            self.sock.close()
            self.sock = None
            print(f"[UDP Audio] Đã dừng lắng nghe trên cổng {self.port}")
