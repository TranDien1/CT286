# Hệ thống quản lý hóa đơn

Ứng dụng React + Vite và Spring Boot. Đăng nhập, phân quyền, quản lý người dùng và trang
tài khoản/sổ nhật ký dùng SQL Server. Các trang nghiệp vụ còn lại vẫn sử dụng dữ liệu mẫu
trong trình duyệt và chưa lưu vào SQL Server.

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

- `src/backend/api.js` – các thao tác nghiệp vụ, mỗi thao tác chạy trọn vẹn hoặc không thay đổi gì
- `src/backend/rules.js` – tính tiền, thuế, bút toán, quá hạn
- `src/backend/queries.js` – truy vấn cho báo cáo
- `src/backend/seed.js` – dữ liệu mẫu
- `src/pages/` – các màn hình


#Thong Branch

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
