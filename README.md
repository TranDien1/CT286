# Hệ thống quản lý hóa đơn

Ứng dụng React + Vite và Spring Boot, lưu dữ liệu nghiệp vụ trong SQL Server.
Các trang hóa đơn, thu chi, bút toán, sổ cái đối tác, báo cáo và tổng quan đều gọi backend.

Xem [báo cáo kiểm thử sơ bộ ngày 05/11/2026](docs/bao-cao-kiem-thu-so-bo-2026-11-05.md)
để đối chiếu luồng bán/mua, bút toán, phân quyền và các bước kiểm thử thủ công.

## Chạy trên localhost

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:5173.

## Tài khoản dùng thử

Tài khoản mẫu do người triển khai tạo có chủ đích, không tự tạo khi chạy ứng dụng.
Mật khẩu được băm bằng BCrypt; hãy thay mật khẩu mẫu sau khi kiểm thử.

## Cấu trúc

- `backend/` – API Spring Boot, kiểm tra nghiệp vụ và truy cập SQL Server
- `src/backend/` – lớp gọi API, kiểu dữ liệu và hàm tính/hiển thị phía frontend
- `src/pages/` – các màn hình React
- `database/invoicing_schema_sqlserver_v7.sql` – DDL hiện hành

## Backend Spring Boot

Backend đặt tại `backend/`, sử dụng SQL Server hiện có và **không** để Hibernate tự tạo hoặc sửa bảng (`ddl-auto: none`).

Sao chép `backend/.env.example` thành `backend/.env` và điền mật khẩu SQL Server trên máy của bạn.
File `.env` được Git bỏ qua và Spring Boot đọc khi chạy từ thư mục `backend`. Các biến môi trường
đã đặt trong terminal có thể được sử dụng thay cho giá trị trong file.

Chạy tại thư mục `backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

Khi chạy thành công, kiểm tra kết nối bằng `GET http://localhost:8080/api/health`.

Phiên đăng nhập được lưu trong bộ nhớ của backend, hết hạn sau 8 giờ và hết hiệu lực khi backend khởi động lại.
Khóa tài khoản hoặc đổi/đặt lại mật khẩu sẽ hủy các phiên cũ. Cơ chế này chỉ phù hợp cho giai đoạn chạy một instance.

Để tạo 3 tài khoản mẫu một lần, thiết lập `SAMPLE_ADMIN_PASSWORD`, `SAMPLE_ACCOUNTANT_PASSWORD`,
`SAMPLE_ACCOUNTANT2_PASSWORD`, sau đó chạy backend với `--app.seed-users=true`. Nếu bất kỳ tên mẫu nào
đã tồn tại, thao tác dừng và không ghi đè. Không bật tùy chọn này khi chạy bình thường.
