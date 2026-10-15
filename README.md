# Hệ thống quản lý hóa đơn

Ứng dụng React + Vite. Phần xử lý nghiệp vụ (đăng nhập, phân quyền, hóa đơn, ghi sổ, thu chi, báo cáo)
chạy ngay trong trình duyệt (`src/backend/`) và lưu dữ liệu vào localStorage của trình duyệt.

## Chạy trên localhost

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:5173.

## Tài khoản dùng thử

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Admin | admin | admin123 |
| Kế toán | ketoan | ketoan123 |
| Kế toán | ketoan2 | ketoan123 |

Nút "Khôi phục dữ liệu mẫu" ở trang đăng nhập đưa dữ liệu về như ban đầu.

## Cấu trúc

- `src/backend/api.js` – các thao tác nghiệp vụ, mỗi thao tác chạy trọn vẹn hoặc không thay đổi gì
- `src/backend/rules.js` – tính tiền, thuế, bút toán, quá hạn
- `src/backend/queries.js` – truy vấn cho báo cáo
- `src/backend/seed.js` – dữ liệu mẫu
- `src/pages/` – các màn hình
