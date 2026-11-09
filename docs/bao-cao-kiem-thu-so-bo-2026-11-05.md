# Báo cáo kiểm thử sơ bộ hệ thống Invoicing

**Ngày kiểm tra:** 05/11/2026. **Mục đích:** chuẩn bị trình bày sơ bộ ngày 06/11/2026 và làm kịch bản kiểm thử thủ công.

## 1. Phạm vi và nguồn đối chiếu

- Luồng nghiệp vụ tham chiếu: `E:/File From CC/HTQL SX DOCS/Hoa don ban.pdf` và `E:/File From CC/HTQL SX DOCS/Hoa don mua.pdf`.
- Cấu trúc dữ liệu đang áp dụng: `database/invoicing_schema_sqlserver_v7.sql`. Các tên trường hoặc cách cài đặt cũ trong PDF không thay thế DDL hiện hành. Hạn thanh toán nằm ở `Journal_Entry.invoice_date_due`; liên kết thanh toán đến hóa đơn là `Payment.payment_for_invoice`.
- Phạm vi đã chốt: chỉ thanh toán tiền mặt qua sổ `CSH`, đủ 100% và một lần; chỉ hóa đơn nháp được sửa; hóa đơn đã ghi sổ bị khóa. Không có thanh toán từng phần, chuyển khoản, bút toán đảo hoặc sửa hóa đơn đã thanh toán.
- Vai trò: `accountant` thao tác nghiệp vụ; `admin` quản lý danh mục, cấu hình/sổ nhật ký, người dùng và hồ sơ. Admin không xem Dashboard, hóa đơn, thu chi, bút toán, sổ cái đối tác hoặc báo cáo.

## 2. Kết quả kiểm tra đã thực hiện

| Hạng mục | Cách kiểm tra | Kết quả |
| --- | --- | --- |
| Backend | Chạy toàn bộ Maven test với `RUN_SQL_TESTS=true` trên database kiểm thử `CT286_Audit_20261029` | **53 test, 0 lỗi, 0 bỏ qua; BUILD SUCCESS**. Có integration test cho bán, mua, thanh toán, đối tác hai vai trò, danh mục, cấu hình và phân quyền. |
| Frontend | `npm run build` | Thành công; 67 module được build. |
| Tính toán báo cáo | Kiểm tra hàm ngày/tuần/tháng, công nợ theo mốc, biểu đồ thu chi và sổ cái đối tác | Đạt với các trường hợp kiểm tra đã chọn. |
| API đang chạy | Backend cổng 8080 nối database kiểm thử; gọi health, đăng nhập, danh mục, hóa đơn, thanh toán, bút toán, công nợ | Các endpoint kiểm tra trả dữ liệu thành công. |
| Giao diện | Mở Vite cổng 5173 với backend kiểm thử; đăng nhập hai vai trò, đi qua các trang, mở bút toán và lọc báo cáo | Điều hướng, dữ liệu và giới hạn vai trò khớp luồng. Đã kiểm tra liên kết từ bút toán hóa đơn sang phiếu thu/chi. |
| SQL Server chính | Chạy truy vấn **chỉ đọc** trên `CT286_Invoicing` để đối chiếu dữ liệu và ràng buộc | Không phát hiện các bất nhất được liệt kê ở mục 4. Dữ liệu chính không bị sửa trong đợt kiểm tra. |

**Giới hạn bằng chứng:** Chưa bấm trực tiếp toàn bộ chuỗi tạo hóa đơn → ghi sổ → thu/chi trên giao diện trong đợt này. Chuỗi đó đã được kiểm tra bằng integration test; mục 6 là kịch bản để tự chạy lại trên UI. Đã tạo thử một đối tác hai vai trò qua UI trên database kiểm thử, kiểm tra lọc hai phía, rồi xóa dữ liệu thử. Tài khoản thử cũng đã được xóa. Hai tiến trình backend/Vite do đợt kiểm tra khởi động đã được tắt.

## 3. Luồng thao tác và dữ liệu lưu

| Giai đoạn | Thao tác trên UI | Hiển thị/kết quả mong đợi | Dữ liệu SQL Server |
| --- | --- | --- | --- |
| Đăng nhập | `/login` → nhập tài khoản | Kế toán vào Tổng quan; admin vào Cấu hình. Menu theo vai trò; đổi mật khẩu tại `/profile`. | Đọc `App_User`; phiên đăng nhập do backend quản lý trong bộ nhớ, mật khẩu dạng BCrypt. |
| Danh mục | `/partners`, `/products`, `/taxes`, `/config` | Đối tác có thể là khách hàng, nhà cung cấp hoặc cả hai; sản phẩm bắt buộc thuộc nhóm, nhóm có cấu hình tài khoản bán/mua; thuế và sổ/tài khoản được hiển thị. | `Partner`, `Product`, `Product_Category`, `Tax`, `Account`, `Journal`. |
| Bán hàng: nháp | `/invoices/new` → chọn khách hàng, ngày, sản phẩm, số lượng, thuế → **Lưu nháp** | Dòng hàng và tổng trước thuế/VAT/tổng tiền; chỉ nháp được sửa hoặc hủy. Khách hàng mới tạo nhanh chỉ nhận một vai trò như đã thống nhất. | `Journal_Entry` loại `out_invoice`, trạng thái nháp; dòng sản phẩm, thuế và công nợ ở `Journal_Item`. Backend tính lại tiền. Các dòng nháp chưa được tính vào sổ cái/công nợ. |
| Bán hàng: ghi sổ | Mở nháp tại `/invoices/:id` → **Ghi sổ** | Số chứng từ `INV/...`, trạng thái đã ghi sổ; không còn sửa nội dung. | Backend tính lại và thay các dòng `Journal_Item`, cập nhật `Journal_Entry` sang `posted`: **Nợ 131** tổng tiền, **Có 511** tiền hàng, **Có 3331** VAT. |
| Mua hàng: nháp | `/bills/new` → chọn nhà cung cấp, ngày, sản phẩm, số lượng, thuế → **Lưu nháp** | Cùng cách tính và trạng thái, nhưng danh sách đối tác lọc theo nhà cung cấp. | `Journal_Entry` loại `in_invoice` và các dòng `Journal_Item`, chưa tính vào sổ cái/công nợ. |
| Mua hàng: ghi sổ | Mở nháp tại `/bills/:id` → **Ghi sổ** | Số chứng từ `BILL/...`, trạng thái đã ghi sổ; khóa sửa. | `Journal_Item`: **Nợ 156** tiền hàng, **Nợ 1331** VAT được khấu trừ, **Có 331** tổng tiền. |
| Thu tiền | Từ hóa đơn bán đã ghi sổ/chưa thanh toán hoặc `/payments` → lập phiếu thu, chọn ngày, xác nhận | Đủ đúng tổng hóa đơn; chỉ một phiếu; hóa đơn thành đã thanh toán. | `Payment` nối hóa đơn qua `payment_for_invoice`, nối bút toán tiền qua `entry_id`; `Journal_Entry` sổ `CSH`; `Journal_Item`: **Nợ 111, Có 131**; dòng công nợ hóa đơn/phiếu được đối soát. |
| Chi tiền | Từ hóa đơn mua đã ghi sổ/chưa thanh toán hoặc `/payments` → lập phiếu chi | Đủ đúng tổng hóa đơn; chỉ một phiếu. | `Payment`, `Journal_Entry` sổ `CSH`; `Journal_Item`: **Nợ 331, Có 111**; đối soát dòng 331. |
| Truy vết kế toán | `/journal-entries` → mở bút toán hóa đơn → tại dòng đã đối soát bấm **Xem bút toán phiếu thu/chi** | Xem Nợ/Có, tổng cân, hóa đơn liên quan và bút toán tiền mặt tương ứng. | Đọc `Journal_Entry`, `Journal_Item`, `Payment` và liên kết hóa đơn. |
| Sổ và báo cáo | `/partner-ledger`, `/reports`, `/` | Sổ 131/331, phát sinh và số dư; báo cáo chưa thanh toán/công nợ/quá hạn/thu chi; Dashboard số liệu thật và biểu đồ thu/chi theo tháng. | Truy vấn dữ liệu hóa đơn, thanh toán, bút toán; không có bảng báo cáo riêng. |

**Ý nghĩa lọc kỳ báo cáo:** Thu/chi tính các phiếu phát sinh **trong kỳ**. Công nợ/chưa thanh toán/quá hạn được tính **tại cuối kỳ đã chọn**; mặc định tính đến hôm nay. Một hóa đơn đã thanh toán sau ngày cuối kỳ vẫn có thể xuất hiện ở công nợ kỳ trước. Bộ lọc có ngày, tuần (thứ Hai đến Chủ nhật), tháng và năm. Danh sách hóa đơn lọc theo ngày hóa đơn; Thu/chi lọc theo ngày thanh toán; Bút toán và Sổ cái đối tác lọc theo ngày hạch toán. Khi xem sổ cái đối tác, chọn riêng tài khoản 131 hoặc 331 nếu muốn giải thích số dư; chế độ gộp có thể bù trừ hai chiều.

## 4. Ảnh chụp dữ liệu và tính nhất quán của database chính

Tại thời điểm kiểm tra, `CT286_Invoicing` có **3 người dùng** (1 admin, 2 kế toán), **13 đối tác** (7 chỉ khách hàng, 6 chỉ nhà cung cấp, chưa có đối tác hai vai trò), **7 tài khoản**, **3 sổ nhật ký**, **10 thuế**, **6 nhóm sản phẩm**, **6 sản phẩm**, **13 hóa đơn** và **7 phiếu thu/chi**. Hóa đơn gồm 6 bán đã ghi sổ (4 đã thu, 2 chưa thu), 5 mua đã ghi sổ (3 đã chi, 2 chưa chi) và 2 nháp (mỗi loại 1). Có 4 phiếu thu, 3 phiếu chi.

Các giá trị Dashboard dự kiến với dữ liệu chính tại ngày 05/11/2026: **phải thu 32.340.000 đ**, **phải trả 23.991.000 đ**, **2 hóa đơn quá hạn với tổng 37.664.000 đ**, **2 nháp**, **tổng thu tiền mặt 183.370.000 đ**, **tổng chi tiền mặt 138.281.000 đ**. Con số trên bản sao kiểm thử có thể thấp hơn do được tạo từ snapshot trước đó. Khi người dùng thay đổi dữ liệu, các số này cũng thay đổi.

Truy vấn kiểm tra cho kết quả **0** ở các nhóm sau: thiếu nhóm sản phẩm, thiếu tài khoản nhóm, thuế gắn sai loại tài khoản, bút toán ghi sổ không cân, hóa đơn báo đã thanh toán nhưng thiếu phiếu, sai số tiền/đối tác/loại phiếu, dòng công nợ đối soát sai, phiếu không thuộc sổ `CSH`, hóa đơn ghi sổ thiếu dòng sản phẩm/công nợ, trùng số hóa đơn và đối tác sai vai trò. Các check constraint đang bật và trusted, gồm ràng buộc đối tác phải có ít nhất một vai trò.

**Giới hạn ràng buộc database:** `Payment.payment_for_invoice` có `UNIQUE` nhưng không có foreign key trực tiếp đến hóa đơn; không có trigger trên các bảng bút toán/thanh toán để kiểm tra đủ toàn bộ quy tắc nghiệp vụ qua SQL. Backend đang kiểm tra loại đối tác, tổng tiền, đối soát, cân bút toán và trạng thái khi thao tác qua API. Vì vậy không nên sửa trực tiếp các bảng này trong SSMS khi trình diễn; truy vấn đọc thì được. Với các thao tác qua ứng dụng, dữ liệu hiện tại nhất quán.

## 5. Hai ví dụ có sẵn để trình bày ngay

### Bán hàng và thu tiền

Mở `/invoices` và tìm `INV/2026/0004` của **Công ty Cổ phần Giáo dục Hướng Dương**, tổng **24.255.000 đ**, trạng thái đã thu. Mở bút toán hóa đơn: Nợ 131 = 24.255.000; Có 511 = 18.250.000 + 3.800.000; Có 3331 = 2.205.000. Tổng Nợ/Có đều 24.255.000. Từ dòng 131 đã đối soát, mở bút toán phiếu thu `CSH/2026/0004`: Nợ 111, Có 131, mỗi bên 24.255.000. Sau đó xem `/payments`, `/partner-ledger` tài khoản 131 và `/reports?tab=payments`.

### Mua hàng và chi tiền

Mở `/bills` và tìm `BILL/2026/0004` của **Công ty TNHH Kho vận Phú Mỹ**, tổng **18.161.000 đ**, trạng thái đã chi. Bút toán hóa đơn: Nợ 156 = 13.950.000 + 2.560.000; Nợ 1331 = 1.651.000; Có 331 = 18.161.000. Từ dòng 331 đã đối soát, mở phiếu chi `CSH/2026/0010`: Nợ 331, Có 111, mỗi bên 18.161.000. Xem tiếp sổ đối tác tài khoản 331 và báo cáo thu/chi.

**Ví dụ chưa thu/chưa chi:** `INV/2026/0003` của **Công ty TNHH Thương mại Minh Phát**, 21.505.000 đ; `BILL/2026/0003` của **Công ty TNHH Máy tính Hải Đăng**, 16.159.000 đ. Hai hóa đơn này đến hạn 28/08/2026 và xuất hiện ở báo cáo quá hạn tại ngày kiểm tra. Dùng chúng để giải thích công nợ trước khi thanh toán. Nếu bạn thanh toán khi kiểm thử thủ công, trạng thái và báo cáo hiện tại sẽ đổi.

**Ví dụ lọc tháng:** `/reports?tab=payments` chọn **Theo tháng**, **07/2026**. Trên bản kiểm thử đã hiện thu 24.255.000 đ, chi 18.161.000 đ. Chuyển sang Công nợ ở cuối tháng 07/2026: phải thu 21.505.000 đ, phải trả 16.159.000 đ; danh sách chưa thanh toán có hai hóa đơn tổng 37.664.000 đ. Đối chiếu lần nữa trên database chính trước khi trình bày vì dữ liệu có thể đã thay đổi.

## 6. Kịch bản tự kiểm thử thủ công theo thứ tự

Nên tạo **đối tác, sản phẩm và hóa đơn mới** cho kịch bản ghi dữ liệu; các ví dụ ở mục 5 dùng để trình bày dữ liệu sẵn có. Ghi lại số chứng từ mới sinh và số tiền để đối chiếu ở các trang sau.

1. **Đăng nhập và phân quyền:** đăng nhập admin, mở `/config`, `/partners`, `/products`, `/taxes`, `/admin/users`, `/profile`; thử `/reports` hoặc `/payments` phải bị chuyển về `/config`. Đăng xuất, đăng nhập kế toán; trang Tổng quan và nghiệp vụ hiển thị, `/admin/users` không vào được.
2. **Danh mục:** dùng kế toán hoặc admin tạo một Partner chọn **Cả hai**; kiểm tra xuất hiện khi lọc khách hàng lẫn nhà cung cấp và trong cả form bán/mua. Tạo nhóm sản phẩm với tài khoản bán/mua phù hợp rồi tạo sản phẩm thuộc nhóm. Không tạo bản sao tên hoặc mã đã có. Trong Cấu hình, admin chỉ sửa tên tài khoản/sổ và tài khoản mặc định phù hợp; giữ nguyên mã tài khoản/sổ.
3. **Hóa đơn bán:** tại `/invoices/new`, chọn khách hàng, sản phẩm, số lượng nguyên phù hợp, thuế; kiểm tra thành tiền và tổng. Lưu nháp, mở lại sửa số lượng, rồi Ghi sổ. Xác nhận không còn sửa được, thấy chứng từ và Nợ 131/Có 511,3331 cân. Lập phiếu thu tiền mặt đủ 100% một lần. Xem trạng thái đã thu, link bút toán phiếu thu, sổ 131 và báo cáo.
4. **Hóa đơn mua:** tại `/bills/new`, chọn nhà cung cấp, sản phẩm, thuế; lưu nháp, Ghi sổ; kiểm tra Nợ 156,1331/Có 331. Lập phiếu chi tiền mặt đủ 100% một lần; kiểm tra Nợ 331/Có 111, đối soát và sổ 331.
5. **Báo cáo và Tổng quan:** ở `/reports`, lần lượt chọn ngày, tuần, tháng và năm; kiểm tra danh sách chưa thanh toán, công nợ, quá hạn và thu/chi. Thử cùng kỳ ở `/invoices`, `/bills`, `/payments`, `/journal-entries` và `/partner-ledger`, lưu ý mỗi trang dùng cột ngày đã ghi trên nhãn lọc. Đối chiếu Tổng quan `/` sau khi tạo và thanh toán với hóa đơn/phiếu vừa lập. Di chuột từng tháng trên biểu đồ để xem thu và chi riêng.
6. **Trường hợp bị chặn:** thử lưu hóa đơn không có đối tác hoặc dòng hàng; chọn nhầm vai trò đối tác; ghi sổ thiếu cấu hình nhóm; sửa hóa đơn đã ghi sổ; thanh toán lại hóa đơn đã thu/chi; tạo thanh toán trước khi ghi sổ. Ứng dụng phải báo lỗi hoặc không đưa ra thao tác đó, và không sinh thêm chứng từ sai.

## 7. Điểm cần nói rõ trong buổi báo cáo

- Hệ thống hiện triển khai đủ luồng bán, mua, thanh toán tiền mặt, bút toán, sổ đối tác, báo cáo, Dashboard và quản trị theo phạm vi đã chốt. Dashboard đã dùng API/SQL Server.
- Phần **xem trước hóa đơn** vẫn dùng thông tin công ty được ghi sẵn trong giao diện và có nhãn “thông tin mẫu”; địa chỉ đối tác lấy từ Partner. Nên nói rõ khi trình bày, chưa xem đây là thông tin pháp nhân của doanh nghiệp.
- Trang Thu/chi hiển thị **tổng thu và tổng chi riêng** theo kỳ đã lọc. Dashboard và tab Thu/chi trong Báo cáo cũng tách hai chiều tiền mặt; đây không phải doanh thu và chi phí kế toán.
- Chưa thực hiện trực tiếp trên UI toàn bộ ca tạo/ghi sổ/thanh toán trong đợt kiểm tra này; integration test đã chạy qua luồng đó trên bản sao SQL Server. Kịch bản mục 6 giúp xác nhận trải nghiệm thao tác trên máy của bạn trước buổi báo cáo.
- Tài liệu `docs/api-dto-contract.md` là bản phác thảo giai đoạn đầu, có nội dung cũ; dùng DDL v7, mã nguồn và báo cáo này cho trạng thái hiện tại.

## 8. Truy vấn SQL chỉ đọc để đối chiếu chứng từ

Chạy trên `CT286_Invoicing` trong SSMS. Đổi số chứng từ ở dòng `DECLARE` để kiểm tra hóa đơn bán/mua tương ứng.

```sql
DECLARE @InvoiceName nvarchar(100) = N'INV/2026/0004';

SELECT je.id, je.name, je.entry_type, je.state, je.invoice_date_due,
       ji.id AS item_id, a.code AS account_code, a.name AS account_name,
       ji.debit, ji.credit, ji.reconciled
FROM Journal_Entry AS je
JOIN Journal_Item AS ji ON ji.entry_id = je.id
JOIN Account AS a ON a.id = ji.account_id
WHERE je.name = @InvoiceName
ORDER BY ji.id;

SELECT p.id AS payment_id, p.payment_for_invoice, p.entry_id AS payment_entry_id,
       pe.name AS payment_number, pe.entry_type AS payment_type
FROM Payment AS p
JOIN Journal_Entry AS ie ON ie.id = p.payment_for_invoice
JOIN Journal_Entry AS pe ON pe.id = p.entry_id
WHERE ie.name = @InvoiceName;
```

