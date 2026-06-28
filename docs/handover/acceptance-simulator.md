# Simulator Acceptance Checklist

Checklist này dùng để xác nhận mức simulator-certified khi chưa có S9/Boxphone thật.

## Điều kiện pass

- [ ] Gateway tests pass.
- [ ] AI runtime tests pass.
- [ ] TypeScript lint/typecheck pass.
- [ ] Command flow smoke runner pass với 3 devices.
- [ ] Soak script pass với 3 devices và 10 calls hoặc 5 iterations tùy runner.
- [ ] Device pairing/token tests pass.
- [ ] Audit log tests pass.
- [ ] Dashboard load được.
- [ ] Device panel không crash.
- [ ] Session panel không crash.
- [ ] Command panel không crash.
- [ ] Audio panel không crash.
- [ ] Docs đã review.
- [ ] Docs marker scan không có placeholder.
- [ ] Git working tree chỉ chứa các thay đổi bàn giao có chủ đích.

## Lệnh kiểm tra đề xuất

```powershell
.\.python312\python.exe -m pytest backend\tests\gateway -v
.\.python312\python.exe -m pytest backend\tests\gateway\ai_runtime -v
npm.cmd run lint
npm.cmd run build
.\.python312\python.exe -m pytest backend\tests\gateway\test_command_flow_runner.py backend\tests\gateway\test_run_soak.py -v
.\.python312\python.exe -m backend.gateway.simulators.run_soak --devices 3 --iterations 5
```

## Ranh giới chứng nhận

Simulator-certified chứng minh logic Gateway, command, AI adapter, audio routing mô phỏng và dashboard. Mức này không chứng minh dial/hangup/audio thật trên S9/Boxphone.
