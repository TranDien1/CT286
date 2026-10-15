
import { sha256 } from 'js-sha256';
import {
  BusinessError, AuthError, fail, TYPE_INFO, PAYMENT_INFO, computeAmounts, buildInvoiceItems, sumItems
} from './rules';
import { todayStr, isValidDate, formatCurrency } from '../utils/format';

const SECRET = 'invoicing-demo-secret';
const nextId = (list) => (list.length > 0 ? Math.max(...list.map(x => x.id)) + 1 : 1);
const nowIso = () => new Date().toISOString();
const replace = (list, item) => list.map(x => (x.id === item.id ? item : x));

export const hashPassword = (password, userName) => sha256(`${userName}:${password}:${SECRET}`);



const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s) => decodeURIComponent(escape(atob(s)));

export const issueToken = (user) => {
  const payload = b64(JSON.stringify({ uid: user.id, ver: user.tokenVersion, iat: Date.now() }));
  return `${payload}.${sha256(payload + SECRET)}`;
};

export const verifyToken = (db, token) => {
  if (!token) throw new AuthError('Vui lòng đăng nhập.');
  const [payload, sig] = String(token).split('.');
  if (!payload || sha256(payload + SECRET) !== sig) throw new AuthError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  let data;
  try { data = JSON.parse(unb64(payload)); } catch { throw new AuthError('Phiên đăng nhập không hợp lệ.'); }
  const user = db.users.find(u => u.id === data.uid);
  if (!user) throw new AuthError('Tài khoản không tồn tại.');
  if (!user.active) throw new AuthError('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
  if (user.tokenVersion !== data.ver) throw new AuthError('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
  return user;
};

// AUTH-04/05/06: kế toán thao tác trên mọi chứng từ và danh mục; Admin chỉ xem.
const requireAccountant = (db, token) => {
  const user = verifyToken(db, token);
  if (user.role !== 'accountant') fail('Admin chỉ được xem, không được tạo, sửa hoặc hủy chứng từ và danh mục.');
  return user;
};

// AUTH-03: chỉ Admin quản lý tài khoản người dùng.
const requireAdmin = (db, token) => {
  const user = verifyToken(db, token);
  if (user.role !== 'admin') fail('Chỉ Admin được quản lý tài khoản người dùng.');
  return user;
};

// ---------------------------------------------------------------------------
// Xác thực và tài khoản (AUTH-01 → AUTH-09)
// ---------------------------------------------------------------------------

export const login = (db, identifier, password) => {
  const id = (identifier || '').trim().toLowerCase();
  if (!id || !password) fail('Vui lòng nhập tên đăng nhập và mật khẩu.');
  const user = db.users.find(u => u.userName.toLowerCase() === id || (u.email || '').toLowerCase() === id);
  if (!user || user.passwordHash !== hashPassword(password, user.userName)) fail('Tên đăng nhập hoặc mật khẩu không đúng.');
  if (!user.active) fail('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
  if (!['admin', 'accountant'].includes(user.role)) fail('Tài khoản không có quyền đăng nhập.'); // AUTH-01
  return { db, result: { token: issueToken(user), user } };
};

const checkPassword = (pw) => {
  if (!pw || pw.length < 6) fail('Mật khẩu phải có ít nhất 6 ký tự.');
};

// AUTH-07: ai đăng nhập cũng được đổi mật khẩu của chính mình. AUTH-08: token cũ mất hiệu lực.
export const changeOwnPassword = (db, token, { oldPassword, newPassword }) => {
  const user = verifyToken(db, token);
  if (user.passwordHash !== hashPassword(oldPassword || '', user.userName)) fail('Mật khẩu hiện tại không đúng.');
  checkPassword(newPassword);
  if (oldPassword === newPassword) fail('Mật khẩu mới phải khác mật khẩu hiện tại.');
  const updated = { ...user, passwordHash: hashPassword(newPassword, user.userName), tokenVersion: user.tokenVersion + 1 };
  return { db: { ...db, users: replace(db.users, updated) }, result: { token: issueToken(updated), user: updated } };
};

// AUTH-02/03: Admin tạo tài khoản cho kế toán (không có đăng ký công khai).
export const createAccountant = (db, token, { userName, fullName, email, password }) => {
  requireAdmin(db, token);
  const name = (userName || '').trim();
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(name)) fail('Tên đăng nhập 3–30 ký tự, chỉ gồm chữ, số, dấu chấm hoặc gạch dưới.');
  if (!(fullName || '').trim()) fail('Vui lòng nhập họ tên.');
  const mail = (email || '').trim();
  if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) fail('Email không hợp lệ.');
  checkPassword(password);
  if (db.users.some(u => u.userName.toLowerCase() === name.toLowerCase())) fail('Tên đăng nhập đã tồn tại.');
  if (mail && db.users.some(u => (u.email || '').toLowerCase() === mail.toLowerCase())) fail('Email đã được dùng cho tài khoản khác.');
  const user = {
    id: nextId(db.users), userName: name, fullName: fullName.trim(), email: mail, role: 'accountant',
    passwordHash: hashPassword(password, name), active: true, tokenVersion: 1, createdAt: nowIso()
  };
  return { db: { ...db, users: [...db.users, user] }, result: { user } };
};

const findAccountantForAdmin = (db, id, admin) => {
  const target = db.users.find(u => u.id === id);
  if (!target) fail('Không tìm thấy tài khoản.');
  if (target.id === admin.id) fail('Không thể thao tác này trên chính tài khoản đang đăng nhập.');
  if (target.role !== 'accountant') fail('Admin chỉ quản lý tài khoản kế toán.');
  return target;
};

// AUTH-03/08/09: khóa/mở khóa thay cho xóa; khóa làm token cũ mất hiệu lực.
export const setUserActive = (db, token, id, active) => {
  const admin = requireAdmin(db, token);
  const target = findAccountantForAdmin(db, id, admin);
  const updated = { ...target, active, tokenVersion: active ? target.tokenVersion : target.tokenVersion + 1 };
  return { db: { ...db, users: replace(db.users, updated) }, result: { user: updated } };
};

export const resetPassword = (db, token, id, newPassword) => {
  const admin = requireAdmin(db, token);
  const target = findAccountantForAdmin(db, id, admin);
  checkPassword(newPassword);
  const updated = { ...target, passwordHash: hashPassword(newPassword, target.userName), tokenVersion: target.tokenVersion + 1 };
  return { db: { ...db, users: replace(db.users, updated) }, result: { user: updated } };
};

// ---------------------------------------------------------------------------
// Danh mục (CAT-01 → CAT-07): chỉ kế toán quản lý; không xóa thứ đã dùng trong giao dịch.
// ---------------------------------------------------------------------------

export const usage = {
  partner: (db, id) => db.invoices.some(i => i.partnerId === id) || db.payments.some(p => p.partnerId === id),
  product: (db, id) => db.invoices.some(i => i.lines.some(l => l.productId === id)),
  tax: (db, id) => db.invoices.some(i => i.lines.some(l => l.taxId === id)),
  category: (db, id) => db.products.some(p => p.categoryId === id)
};

export const savePartner = (db, token, data) => {
  const user = requireAccountant(db, token);
  const name = (data.name || '').trim();
  if (!name) fail('Vui lòng nhập tên đối tác.');
  if (!['customer', 'vendor'].includes(data.partnerType)) fail('Loại đối tác không hợp lệ.');
  const email = (data.email || '').trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Email không hợp lệ.');
  const taxCode = (data.taxCode || '').trim();
  if (taxCode && !/^\d{10}(-\d{3})?$/.test(taxCode)) fail('Mã số thuế gồm 10 chữ số (hoặc 10 số kèm -XXX cho chi nhánh).');
  if (db.partners.some(p => p.id !== data.id && p.partnerType === data.partnerType && p.name.toLowerCase() === name.toLowerCase())) {
    fail('Đã có đối tác cùng tên và cùng loại.');
  }
  const fields = {
    name, partnerType: data.partnerType, email, phone: (data.phone || '').trim(),
    address: (data.address || '').trim(), city: (data.city || '').trim(), taxCode
  };
  if (data.id) {
    const old = db.partners.find(p => p.id === data.id);
    if (!old) fail('Không tìm thấy đối tác.');
    if (old.partnerType !== fields.partnerType && usage.partner(db, old.id)) fail('Đối tác đã có giao dịch nên không đổi được loại khách hàng/nhà cung cấp.');
    const updated = { ...old, ...fields };
    return { db: { ...db, partners: replace(db.partners, updated) }, result: { partner: updated } };
  }
  const partner = { id: nextId(db.partners), ...fields, active: true, createdBy: user.id, createdAt: nowIso() };
  return { db: { ...db, partners: [...db.partners, partner] }, result: { partner } };
};

// CAT-03: Partner có cột active để ngừng hoạt động thay cho xóa.
export const setPartnerActive = (db, token, id, active) => {
  requireAccountant(db, token);
  const p = db.partners.find(x => x.id === id);
  if (!p) fail('Không tìm thấy đối tác.');
  const updated = { ...p, active };
  return { db: { ...db, partners: replace(db.partners, updated) }, result: { partner: updated } };
};

export const deletePartner = (db, token, id) => {
  requireAccountant(db, token);
  if (usage.partner(db, id)) fail('Đối tác đã được dùng trong giao dịch nên không xóa được. Hãy chuyển sang ngừng hoạt động.');
  return { db: { ...db, partners: db.partners.filter(p => p.id !== id) }, result: {} };
};

const checkProductTax = (db, taxId, use, label) => {
  if (taxId === null || taxId === '' || taxId === undefined) return null;
  const tax = db.taxes.find(t => t.id === Number(taxId));
  if (!tax) fail(`${label} không tồn tại.`);
  if (tax.typeTaxUse !== use) fail(`${label} phải là thuế ${use === 'sale' ? 'bán' : 'mua'}.`); // CAT-05
  return tax.id;
};

export const saveProduct = (db, token, data) => {
  const user = requireAccountant(db, token);
  const name = (data.name || '').trim();
  if (!name) fail('Vui lòng nhập tên sản phẩm.');
  const listPrice = Number(data.listPrice);
  const standardPrice = Number(data.standardPrice);
  if (data.listPrice === '' || Number.isNaN(listPrice) || listPrice < 0) fail('Giá bán không được âm.');
  if (data.standardPrice === '' || Number.isNaN(standardPrice) || standardPrice < 0) fail('Giá mua không được âm.');
  const categoryId = data.categoryId ? Number(data.categoryId) : null;
  if (categoryId && !db.categories.some(c => c.id === categoryId)) fail('Danh mục không tồn tại.');
  if (db.products.some(p => p.id !== data.id && p.name.toLowerCase() === name.toLowerCase())) fail('Đã có sản phẩm cùng tên.');
  const fields = {
    name, categoryId, listPrice, standardPrice,
    saleTaxId: checkProductTax(db, data.saleTaxId, 'sale', 'Thuế bán mặc định'),
    purchaseTaxId: checkProductTax(db, data.purchaseTaxId, 'purchase', 'Thuế mua mặc định')
  };
  if (data.id) {
    const old = db.products.find(p => p.id === data.id);
    if (!old) fail('Không tìm thấy sản phẩm.');
    const updated = { ...old, ...fields };
    return { db: { ...db, products: replace(db.products, updated) }, result: { product: updated } };
  }
  const product = { id: nextId(db.products), ...fields, active: true, createdBy: user.id, createdAt: nowIso() };
  return { db: { ...db, products: [...db.products, product] }, result: { product } };
};

export const setProductActive = (db, token, id, active) => {
  requireAccountant(db, token);
  const p = db.products.find(x => x.id === id);
  if (!p) fail('Không tìm thấy sản phẩm.');
  const updated = { ...p, active };
  return { db: { ...db, products: replace(db.products, updated) }, result: { product: updated } };
};

export const deleteProduct = (db, token, id) => {
  requireAccountant(db, token);
  if (usage.product(db, id)) fail('Sản phẩm đã được dùng trong giao dịch nên không xóa được. Hãy chuyển sang ngừng hoạt động.');
  return { db: { ...db, products: db.products.filter(p => p.id !== id) }, result: {} };
};

// CAT-07: Product_Category không có cột active.
export const saveCategory = (db, token, data) => {
  requireAccountant(db, token);
  const name = (data.name || '').trim();
  if (!name) fail('Vui lòng nhập tên danh mục.');
  if (db.categories.some(c => c.id !== data.id && c.name.toLowerCase() === name.toLowerCase())) fail('Đã có danh mục cùng tên.');
  if (data.id) {
    const old = db.categories.find(c => c.id === data.id);
    if (!old) fail('Không tìm thấy danh mục.');
    const updated = { ...old, name };
    return { db: { ...db, categories: replace(db.categories, updated) }, result: { category: updated } };
  }
  const category = { id: nextId(db.categories), name };
  return { db: { ...db, categories: [...db.categories, category] }, result: { category } };
};

export const deleteCategory = (db, token, id) => {
  requireAccountant(db, token);
  if (usage.category(db, id)) fail('Danh mục đang có sản phẩm nên không xóa được.');
  return { db: { ...db, categories: db.categories.filter(c => c.id !== id) }, result: {} };
};

// CAT-04: không sửa thuế suất (và loại) của thuế đã dùng; CAT-07: Tax không có cột active.
export const saveTax = (db, token, data) => {
  requireAccountant(db, token);
  const name = (data.name || '').trim();
  if (!name) fail('Vui lòng nhập tên thuế.');
  const amount = Number(data.amount);
  if (data.amount === '' || Number.isNaN(amount) || amount < 0 || amount > 100) fail('Thuế suất phải từ 0 đến 100%.');
  if (!['sale', 'purchase'].includes(data.typeTaxUse)) fail('Loại thuế phải là bán hoặc mua.');
  if (!db.accounts.some(a => a.code === data.accountCode)) fail('Tài khoản thuế không tồn tại.');
  if (db.taxes.some(t => t.id !== data.id && t.name.toLowerCase() === name.toLowerCase())) fail('Đã có thuế cùng tên.');
  const fields = { name, amount, typeTaxUse: data.typeTaxUse, accountCode: data.accountCode };
  if (data.id) {
    const old = db.taxes.find(t => t.id === data.id);
    if (!old) fail('Không tìm thấy thuế.');
    if (usage.tax(db, old.id)) {
      if (old.amount !== amount) fail('Thuế đã được dùng trong giao dịch nên không sửa được thuế suất. Hãy tạo thuế mới.');
      if (old.typeTaxUse !== fields.typeTaxUse) fail('Thuế đã được dùng trong giao dịch nên không đổi được loại bán/mua.');
      if (old.accountCode !== fields.accountCode) fail('Thuế đã được dùng trong giao dịch nên không đổi được tài khoản.');
    }
    const usedAsDefault = db.products.some(p => (p.saleTaxId === old.id && fields.typeTaxUse !== 'sale') || (p.purchaseTaxId === old.id && fields.typeTaxUse !== 'purchase'));
    if (usedAsDefault) fail('Thuế đang là thuế mặc định của sản phẩm nên không đổi được loại bán/mua.');
    const updated = { ...old, ...fields };
    return { db: { ...db, taxes: replace(db.taxes, updated) }, result: { tax: updated } };
  }
  const tax = { id: nextId(db.taxes), ...fields };
  return { db: { ...db, taxes: [...db.taxes, tax] }, result: { tax } };
};

export const deleteTax = (db, token, id) => {
  requireAccountant(db, token);
  if (usage.tax(db, id)) fail('Thuế đã được dùng trong giao dịch nên không xóa được.');
  if (db.products.some(p => p.saleTaxId === id || p.purchaseTaxId === id)) fail('Thuế đang là thuế mặc định của sản phẩm nên không xóa được.');
  return { db: { ...db, taxes: db.taxes.filter(t => t.id !== id) }, result: {} };
};

// ---------------------------------------------------------------------------
// Hóa đơn (INV-01 → INV-14, mục 4, POST-01 → POST-08, DATE-01 → DATE-04)
// ---------------------------------------------------------------------------

const validateInvoiceData = (db, entryType, data, previous) => {
  const info = TYPE_INFO[entryType];
  if (!info) fail('Loại hóa đơn không hợp lệ.');

  const partner = db.partners.find(p => p.id === Number(data.partnerId));
  if (!partner) fail(`Vui lòng chọn ${info.partnerLabel.toLowerCase()}.`);
  if (partner.partnerType !== info.partnerType) fail(`${info.label} phải chọn đối tác là ${info.partnerLabel.toLowerCase()}.`); // INV-03
  if (!partner.active && (!previous || previous.partnerId !== partner.id)) fail(`Đối tác "${partner.name}" đã ngừng hoạt động.`);

  if (!isValidDate(data.invoiceDate)) fail('Vui lòng nhập ngày hóa đơn.');
  if (!isValidDate(data.invoiceDateDue)) fail('Vui lòng nhập hạn thanh toán.');
  if (data.invoiceDateDue < data.invoiceDate) fail('Hạn thanh toán không được trước ngày hóa đơn.'); // INV-06
  if (!isValidDate(data.date)) fail('Vui lòng nhập ngày hạch toán.');
  if (data.date < data.invoiceDate) fail('Ngày hạch toán phải bằng hoặc sau ngày hóa đơn.'); // DATE-04

  // CAT-02: sản phẩm ngừng hoạt động không chọn mới được; dòng cũ đã có thì vẫn giữ.
  const prevProductIds = new Set((previous?.lines || []).map(l => Number(l.productId)));
  (data.lines || []).forEach((l, i) => {
    const row = `Dòng ${i + 1}`;
    const product = db.products.find(p => p.id === Number(l.productId));
    if (!product) fail(`${row}: vui lòng chọn sản phẩm.`); // INV-04
    if (!product.active && !prevProductIds.has(product.id)) fail(`${row}: sản phẩm "${product.name}" đã ngừng hoạt động.`);
    if (!(Number(l.quantity) > 0)) fail(`${row}: số lượng phải lớn hơn 0.`);
    const price = Number(l.priceUnit);
    if (l.priceUnit === '' || l.priceUnit === null || Number.isNaN(price) || price < 0) fail(`${row}: đơn giá không được âm.`);
    const tax = db.taxes.find(t => t.id === Number(l.taxId));
    if (!tax) fail(`${row}: vui lòng chọn thuế.`);
    if (tax.typeTaxUse !== info.taxUse) fail(`${row}: ${info.label.toLowerCase()} chỉ dùng thuế ${info.taxUse === 'sale' ? 'bán' : 'mua'}.`); // INV-05, CAT-05
  });
};

// Chỉ nhận các trường được phép; không nhận tổng tiền, tài khoản hay số chứng từ từ frontend (INV-08, INV-11).
const pickInvoiceFields = (data) => ({
  partnerId: Number(data.partnerId),
  invoiceDate: data.invoiceDate,
  invoiceDateDue: data.invoiceDateDue,
  date: data.date,
  paymentTerms: data.paymentTerms || '',
  notes: (data.notes || '').trim(),
  lines: (data.lines || []).map((l, i) => ({
    id: i + 1,
    productId: Number(l.productId),
    quantity: Number(l.quantity),
    priceUnit: Number(l.priceUnit),
    taxId: Number(l.taxId)
  }))
});

const withComputed = (db, entryType, fields) => {
  const computed = computeAmounts(fields.lines, db.taxes);
  return {
    ...fields,
    amountUntaxed: computed.amountUntaxed,
    amountTax: computed.amountTax,
    amountTotal: computed.amountTotal,
    items: buildInvoiceItems(entryType, computed, db) // tính lại và thay thế dòng cũ, không để trùng
  };
};

// POST-05/06/07: số riêng theo loại và năm, bắt đầu lại từ 0001 mỗi năm.
const takeSequence = (sequences, code, dateStr) => {
  const key = `${code}/${dateStr.slice(0, 4)}`;
  const n = (sequences[key] || 0) + 1;
  return { name: `${key}/${String(n).padStart(4, '0')}`, sequences: { ...sequences, [key]: n } };
};

const getInvoice = (db, id) => {
  const inv = db.invoices.find(i => i.id === Number(id));
  if (!inv) fail('Không tìm thấy hóa đơn.');
  return inv;
};

// INV-02: hóa đơn mới ở trạng thái draft, chưa có số chính thức.
export const createInvoice = (db, token, entryType, data) => {
  const user = requireAccountant(db, token);
  validateInvoiceData(db, entryType, data, null);
  const invoice = {
    id: nextId(db.invoices),
    entryType,
    journalCode: TYPE_INFO[entryType].code,
    name: null,
    state: 'draft',
    paymentState: 'not_paid',
    createdBy: user.id, // AUDIT-01
    createdAt: nowIso(),
    ...withComputed(db, entryType, pickInvoiceFields(data))
  };
  return { db: { ...db, invoices: [...db.invoices, invoice] }, result: { invoice } };
};

// Mục 4: chỉ sửa khi draft (kể cả đối tác và dòng hàng sau khi chuyển về nháp).
export const updateInvoice = (db, token, id, data) => {
  requireAccountant(db, token);
  const inv = getInvoice(db, id);
  if (inv.state !== 'draft') fail('Chỉ sửa được hóa đơn nháp. Hóa đơn đã ghi sổ phải chuyển về nháp trước.');
  validateInvoiceData(db, inv.entryType, data, inv);
  const updated = { ...inv, ...withComputed(db, inv.entryType, pickInvoiceFields(data)) };
  return { db: { ...db, invoices: replace(db.invoices, updated) }, result: { invoice: updated } };
};

export const postInvoice = (db, token, id) => {
  requireAccountant(db, token);
  const inv = getInvoice(db, id);
  if (inv.state !== 'draft') fail('Chỉ hóa đơn nháp mới được ghi sổ.'); // POST-01
  if (inv.lines.length === 0) fail('Hóa đơn phải có ít nhất một dòng hàng trước khi ghi sổ.');
  validateInvoiceData(db, inv.entryType, inv, inv); // POST-02
  const recomputed = withComputed(db, inv.entryType, pickInvoiceFields(inv));
  const { debit, credit } = sumItems(recomputed.items);
  if (debit !== credit) fail(`Bút toán không cân (Nợ ${formatCurrency(debit)} ≠ Có ${formatCurrency(credit)}). Không ghi sổ.`); // POST-03

  let { sequences } = db;
  let name = inv.name; // POST-08: đã có số thì giữ nguyên
  if (!name) ({ name, sequences } = takeSequence(sequences, inv.journalCode, inv.date)); // POST-04

  const posted = { ...inv, ...recomputed, name, state: 'posted', paymentState: 'not_paid', postedAt: nowIso() };
  return { db: { ...db, sequences, invoices: replace(db.invoices, posted) }, result: { invoice: posted } };
};

export const resetToDraft = (db, token, id) => {
  requireAccountant(db, token);
  const inv = getInvoice(db, id);
  if (inv.state !== 'posted') fail('Chỉ hóa đơn đã ghi sổ mới chuyển về nháp được.');
  if (inv.paymentState !== 'not_paid') fail('Hóa đơn đã thanh toán, chưa hỗ trợ chỉnh sửa hoặc hủy.');
  const draft = { ...inv, state: 'draft' };
  return { db: { ...db, invoices: replace(db.invoices, draft) }, result: { invoice: draft } };
};

// Mục 4: hủy là đổi trạng thái (không xóa); chỉ từ nháp; không khôi phục.
export const cancelInvoice = (db, token, id) => {
  requireAccountant(db, token);
  const inv = getInvoice(db, id);
  if (inv.state === 'cancel') fail('Hóa đơn đã bị hủy trước đó.');
  if (inv.state !== 'draft') fail('Chỉ hủy được hóa đơn nháp. Hóa đơn đã ghi sổ phải chuyển về nháp trước.');
  const cancelled = { ...inv, state: 'cancel', cancelledAt: nowIso() };
  return { db: { ...db, invoices: replace(db.invoices, cancelled) }, result: { invoice: cancelled } };
};

// ---------------------------------------------------------------------------
// Phiếu thu / phiếu chi (PAY-01 → PAY-12, mục 5.1)
// ---------------------------------------------------------------------------

/**
 * args: { invoiceId, date, memo, paymentType?, partnerId? }
 * paymentType/partnerId (nếu màn hình gửi) chỉ dùng để đối chiếu; giá trị thật lấy từ hóa đơn (PAY-05).
 */
export const registerPayment = (db, token, args) => {
  const user = requireAccountant(db, token);
  const inv = getInvoice(db, args.invoiceId);
  const info = TYPE_INFO[inv.entryType];

  if (inv.state !== 'posted') fail('Chỉ lập phiếu cho hóa đơn đã ghi sổ.'); // PAY-01, PAY-12
  if (inv.paymentState !== 'not_paid') fail('Hóa đơn này đã được thanh toán.'); // PAY-03
  if (args.paymentType && args.paymentType !== info.paymentType) {
    fail(info.paymentType === 'inbound' ? 'Hóa đơn bán chỉ được lập phiếu thu.' : 'Hóa đơn mua chỉ được lập phiếu chi.'); // PAY-04
  }
  if (args.partnerId && Number(args.partnerId) !== inv.partnerId) fail('Đối tác không khớp với hóa đơn.'); // PAY-12

  const payDate = args.date || todayStr(); // PAY-11
  if (!isValidDate(payDate)) fail('Ngày thanh toán không hợp lệ.');

  const cash = db.journals.find(j => j.type === 'cash'); // PAY-06
  if (!cash) fail('Chưa cấu hình sổ tiền mặt.');
  const invJournal = db.journals.find(j => j.code === inv.journalCode);
  const counterpart = invJournal.counterpartAccount; // 131 (thu) / 331 (chi)
  const cashAccount = cash.defaultAccount; // 111
  const amount = inv.amountTotal; // PAY-02, PAY-10: trả đủ, không phạt
  const paymentType = info.paymentType;
  const isInbound = paymentType === 'inbound';

  const { name, sequences } = takeSequence(db.sequences, PAYMENT_INFO[paymentType].code, payDate);
  const paymentId = nextId(db.payments);
  const entryId = nextId(db.paymentEntries);

  // Mục 5.1: Phiếu thu Nợ 111 / Có 131; Phiếu chi Nợ 331 / Có 111
  const items = isInbound
    ? [
      { id: 1, displayType: 'liquidity', accountCode: cashAccount, label: `Thu tiền ${inv.name}`, debit: amount, credit: 0, reconciled: false },
      { id: 2, displayType: 'payment_term', accountCode: counterpart, label: `Tất toán ${inv.name}`, debit: 0, credit: amount, reconciled: true }
    ]
    : [
      { id: 1, displayType: 'payment_term', accountCode: counterpart, label: `Tất toán ${inv.name}`, debit: amount, credit: 0, reconciled: true },
      { id: 2, displayType: 'liquidity', accountCode: cashAccount, label: `Chi tiền ${inv.name}`, debit: 0, credit: amount, reconciled: false }
    ];
  const { debit, credit } = sumItems(items);
  if (debit !== credit) fail('Bút toán thanh toán không cân.');

  const payment = {
    id: paymentId, name, paymentType, partnerId: inv.partnerId, invoiceId: inv.id,
    amount, date: payDate, journalCode: cash.code, memo: (args.memo || '').trim() || `Thanh toán ${inv.name}`,
    entryId, createdBy: user.id, createdAt: nowIso()
  };
  const entry = {
    id: entryId, name, entryType: 'entry', journalCode: cash.code, partnerId: inv.partnerId,
    date: payDate, state: 'posted', items, paymentId, createdBy: user.id, createdAt: nowIso()
  };
  // PAY-09: chuyển paid và đánh dấu đối soát dòng công nợ của hóa đơn
  const paidInvoice = {
    ...inv,
    paymentState: 'paid',
    items: inv.items.map(it => (it.displayType === 'payment_term' ? { ...it, reconciled: true } : it))
  };

  return {
    db: {
      ...db,
      sequences,
      payments: [...db.payments, payment],
      paymentEntries: [...db.paymentEntries, entry],
      invoices: replace(db.invoices, paidInvoice)
    },
    result: { payment }
  };
};

export { BusinessError, AuthError };
