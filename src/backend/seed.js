// Dữ liệu mẫu ban đầu. Hóa đơn và phiếu thu/chi được tạo bằng chính các hàm nghiệp vụ
// nên số chứng từ, bút toán và đối soát đều đúng quy tắc.
import * as api from './api';
import { todayStr, addDays } from '../utils/format';

const now = new Date().toISOString();

const users = [
  { id: 1, userName: 'admin', fullName: 'Nguyễn Văn A', email: 'admin@congty.vn', role: 'admin', password: 'admin123' },
  { id: 2, userName: 'ketoan', fullName: 'Trần Thị B', email: 'ketoan@congty.vn', role: 'accountant', password: 'ketoan123' },
  { id: 3, userName: 'ketoan2', fullName: 'Lê Minh C', email: 'ketoan2@congty.vn', role: 'accountant', password: 'ketoan123' }
].map(({ password, ...u }) => ({
  ...u, passwordHash: api.hashPassword(password, u.userName), active: true, tokenVersion: 1, createdAt: now
}));

const accounts = [
  { code: '111', name: 'Tiền mặt', type: 'Tiền' },
  { code: '131', name: 'Phải thu của khách hàng', type: 'Phải thu' },
  { code: '1331', name: 'Thuế GTGT được khấu trừ', type: 'Tài sản' },
  { code: '156', name: 'Hàng hóa', type: 'Tài sản' },
  { code: '331', name: 'Phải trả cho người bán', type: 'Phải trả' },
  { code: '3331', name: 'Thuế GTGT phải nộp', type: 'Nợ phải trả' },
  { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', type: 'Doanh thu' }
];

// INV-11, PAY-06: tài khoản lấy từ cấu hình sổ
const journals = [
  { id: 1, code: 'INV', name: 'Hóa đơn bán', type: 'sale', defaultAccount: '511', counterpartAccount: '131' },
  { id: 2, code: 'BILL', name: 'Hóa đơn mua', type: 'purchase', defaultAccount: '156', counterpartAccount: '331' },
  { id: 3, code: 'CASH', name: 'Tiền mặt', type: 'cash', defaultAccount: '111', counterpartAccount: null }
];

const taxes = [
  { id: 1, name: 'GTGT bán 10%', amount: 10, typeTaxUse: 'sale', accountCode: '3331' },
  { id: 2, name: 'GTGT bán 8%', amount: 8, typeTaxUse: 'sale', accountCode: '3331' },
  { id: 3, name: 'GTGT bán 5%', amount: 5, typeTaxUse: 'sale', accountCode: '3331' },
  { id: 4, name: 'GTGT bán 0%', amount: 0, typeTaxUse: 'sale', accountCode: '3331' },
  { id: 11, name: 'GTGT mua 10%', amount: 10, typeTaxUse: 'purchase', accountCode: '1331' },
  { id: 12, name: 'GTGT mua 8%', amount: 8, typeTaxUse: 'purchase', accountCode: '1331' },
  { id: 13, name: 'GTGT mua 5%', amount: 5, typeTaxUse: 'purchase', accountCode: '1331' },
  { id: 14, name: 'GTGT mua 0%', amount: 0, typeTaxUse: 'purchase', accountCode: '1331' }
];

const categories = [
  { id: 1, name: 'Thiết bị máy tính' },
  { id: 2, name: 'Phần mềm' },
  { id: 3, name: 'Dịch vụ' },
  { id: 4, name: 'Văn phòng phẩm' }
];

const p = (id, name, categoryId, listPrice, standardPrice, saleTaxId, purchaseTaxId, active = true) => ({
  id, name, categoryId, listPrice, standardPrice, saleTaxId, purchaseTaxId, active, createdBy: 2, createdAt: now
});
const products = [
  p(1, 'Laptop Dell Inspiron 15', 1, 15000000, 12500000, 1, 11),
  p(2, 'Màn hình Samsung 27"', 1, 7500000, 6000000, 1, 11),
  p(3, 'Bàn phím cơ Logitech', 1, 2500000, 1900000, 1, 11),
  p(4, 'Chuột không dây Microsoft', 1, 800000, 550000, 1, 11),
  p(5, 'Dịch vụ tư vấn IT', 3, 5000000, 0, 2, 12),
  p(6, 'Dịch vụ bảo trì hệ thống', 3, 3000000, 0, 2, 12),
  p(7, 'Phần mềm quản lý', 2, 12000000, 9000000, 1, 11),
  p(8, 'Máy in HP LaserJet', 1, 6000000, 4800000, 1, 11, false),
  p(9, 'Giấy in A4 (thùng)', 4, 450000, 380000, 3, 13)
];

const pt = (id, name, partnerType, email, phone, address, city, taxCode, active = true) => ({
  id, name, partnerType, email, phone, address, city, taxCode, active, createdBy: 2, createdAt: now
});
const partners = [
  pt(1, 'Công ty TNHH Thương mại ABC', 'customer', 'contact@abc.vn', '0901234567', '123 Nguyễn Văn Linh', 'Hà Nội', '0101234567'),
  pt(2, 'Công ty CP Công nghệ XYZ', 'customer', 'info@xyz.vn', '0912345678', '456 Lê Lợi', 'TP.HCM', '0301234567'),
  pt(3, 'Công ty TNHH Đại Phát', 'customer', 'sales@daiphat.com', '0923456789', '789 Trần Hưng Đạo', 'Đà Nẵng', '0401234567'),
  pt(4, 'Công ty CP Hoàng Gia', 'customer', 'hello@hoanggia.vn', '0934567890', '321 Hai Bà Trưng', 'Hải Phòng', '0201234567'),
  pt(5, 'Cửa hàng Minh Anh', 'customer', 'minhanh@gmail.com', '0945678901', '654 Lý Thái Tổ', 'Cần Thơ', '0501234567'),
  pt(6, 'Công ty TNHH Sao Việt', 'customer', 'contact@saoviet.vn', '0956789012', '987 Phạm Văn Đồng', 'Nha Trang', '0601234567', false),
  pt(101, 'Công ty TNHH Cung ứng Phương Nam', 'vendor', 'supply@phuongnam.vn', '0812345678', '111 Nguyễn Trãi', 'TP.HCM', '0309876543'),
  pt(102, 'Công ty CP Nguyên liệu Sài Gòn', 'vendor', 'raw@saigon.vn', '0823456789', '222 Lê Duẩn', 'TP.HCM', '0308765432'),
  pt(103, 'Công ty TNHH Dịch vụ Logistics Việt', 'vendor', 'logistics@vietlog.vn', '0834567890', '333 Tôn Đức Thắng', 'Hải Phòng', '0207654321'),
  pt(104, 'Nhà phân phối Hòa Phát', 'vendor', 'dist@hoaphat.vn', '0845678901', '444 Giải Phóng', 'Hà Nội', '0106543210')
];

export const buildSeedDb = () => {
  let db = {
    version: 2,
    users, accounts, journals, taxes, categories, products, partners,
    invoices: [], payments: [], paymentEntries: [], sequences: {}
  };
  const T = todayStr();
  const d = (n) => addDays(T, n);
  const run = (fn, ...args) => { const r = fn(db, ...args); db = r.db; return r.result; };

  // Đăng nhập kế toán để tạo dữ liệu
  const { token } = api.login(db, 'ketoan', 'ketoan123').result;

  const make = (type, partnerId, invoiceDate, termDays, lines, notes = '') => run(api.createInvoice, token, type, {
    partnerId, invoiceDate, invoiceDateDue: addDays(invoiceDate, termDays), date: invoiceDate,
    paymentTerms: termDays === 0 ? 'Thanh toán ngay' : `${termDays} ngày`, notes,
    lines: lines.map(([productId, quantity, priceUnit, taxId]) => ({ productId, quantity, priceUnit, taxId }))
  }).invoice;
  const post = (inv) => run(api.postInvoice, token, inv.id).invoice;
  const pay = (inv, date) => run(api.registerPayment, token, { invoiceId: inv.id, date });

  // Hóa đơn bán
  const s1 = post(make('out_invoice', 1, d(-75), 30, [[1, 2, 15000000, 1]], 'Giao hàng tại kho Hà Nội'));
  pay(s1, d(-50));
  post(make('out_invoice', 2, d(-40), 30, [[2, 5, 7500000, 1], [4, 5, 800000, 1]])); // quá hạn
  post(make('out_invoice', 3, d(-15), 15, [[5, 1, 5000000, 2], [6, 1, 3000000, 2]])); // đến hạn hôm nay, chưa quá hạn
  const s4 = post(make('out_invoice', 4, d(-20), 30, [[7, 1, 12000000, 1]]));
  pay(s4, d(-2));
  post(make('out_invoice', 4, d(-5), 30, [[3, 4, 2500000, 1], [9, 10, 450000, 3]]));
  make('out_invoice', 5, d(-1), 0, [[4, 3, 800000, 1]]); // nháp
  const c = make('out_invoice', 1, d(-3), 15, [[2, 1, 7500000, 1]]);
  run(api.cancelInvoice, token, c.id); // đã hủy

  // Hóa đơn mua
  const b1 = post(make('in_invoice', 101, d(-60), 30, [[1, 3, 12500000, 11]]));
  pay(b1, d(-35));
  post(make('in_invoice', 102, d(-45), 30, [[9, 40, 380000, 13]])); // quá hạn
  post(make('in_invoice', 104, d(-10), 30, [[2, 4, 6000000, 11], [3, 6, 1900000, 11]]));
  make('in_invoice', 103, d(-2), 15, [[5, 1, 2000000, 12]]); // nháp

  return db;
};
