// Các quy tắc tính toán dùng chung (màn hình dùng để xem trước, backend dùng để tính chính thức).
import { todayStr } from '../utils/format';

export class BusinessError extends Error {}
export class AuthError extends Error {}
export const fail = (msg) => { throw new BusinessError(msg); };

// INV-01: loại chứng từ ↔ sổ
export const TYPE_INFO = {
  out_invoice: {
    code: 'INV', label: 'Hóa đơn bán', plural: 'Hóa đơn bán', partnerType: 'customer',
    partnerLabel: 'Khách hàng', taxUse: 'sale', path: '/invoices', paymentType: 'inbound'
  },
  in_invoice: {
    code: 'BILL', label: 'Hóa đơn mua', plural: 'Hóa đơn mua', partnerType: 'vendor',
    partnerLabel: 'Nhà cung cấp', taxUse: 'purchase', path: '/bills', paymentType: 'outbound'
  }
};

export const PAYMENT_INFO = {
  inbound: { code: 'REC', label: 'Phiếu thu', invoiceType: 'out_invoice', partnerType: 'customer' },
  outbound: { code: 'PAY', label: 'Phiếu chi', invoiceType: 'in_invoice', partnerType: 'vendor' }
};

export const PAYMENT_TERMS = [
  { label: 'Thanh toán ngay', days: 0 },
  { label: '15 ngày', days: 15 },
  { label: '30 ngày', days: 30 },
  { label: '45 ngày', days: 45 }
];

/**
 * DATE-05 → DATE-08: quá hạn tính khi truy vấn, không lưu.
 * Chỉ khi state = posted, payment_state = not_paid và hôm nay > hạn thanh toán
 * (đúng ngày đến hạn chưa quá hạn).
 */
export const isOverdue = (inv, today = todayStr()) =>
  !!inv && inv.state === 'posted' && inv.paymentState === 'not_paid' && today > inv.invoiceDateDue;

export const overdueDays = (inv, today = todayStr()) => {
  if (!isOverdue(inv, today)) return 0;
  const [y1, m1, d1] = inv.invoiceDateDue.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

/**
 * INV-07: đơn giá chưa thuế. INV-09: làm tròn tiền thuế từng dòng tới đồng rồi cộng;
 * tổng = tiền chưa thuế + tiền thuế. INV-10: gộp tiền thuế theo từng loại thuế.
 */
export const computeAmounts = (lines, taxes) => {
  const groups = {};
  let amountUntaxed = 0;
  let amountTax = 0;
  const computedLines = lines.map(l => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.priceUnit) || 0;
    const subtotal = Math.round(qty * price);
    const tax = taxes.find(t => t.id === Number(l.taxId));
    const taxAmount = tax ? Math.round(subtotal * tax.amount / 100) : 0;
    amountUntaxed += subtotal;
    amountTax += taxAmount;
    if (tax) {
      groups[tax.id] = groups[tax.id] || { tax, base: 0, amount: 0 };
      groups[tax.id].base += subtotal;
      groups[tax.id].amount += taxAmount;
    }
    return { ...l, subtotal, taxAmount };
  });
  return {
    lines: computedLines,
    amountUntaxed,
    amountTax,
    amountTotal: amountUntaxed + amountTax,
    taxGroups: Object.values(groups)
  };
};

/**
 * Mục 2.1 + INV-11/12/13: các dòng bút toán (Journal_Item) của hóa đơn.
 * - Hóa đơn bán: Có 511 (hàng), Có 3331 (thuế), Nợ 131 (công nợ)
 * - Hóa đơn mua: Nợ 156 (hàng), Nợ 1331 (thuế), Có 331 (công nợ)
 * Tài khoản lấy từ cấu hình sổ và thuế. Dòng hàng lưu sản phẩm, số lượng, đơn giá, thuế;
 * dòng thuế và dòng công nợ không lưu sản phẩm; không dòng nào lưu đối tác.
 */
export const buildInvoiceItems = (entryType, computed, db) => {
  const isSale = entryType === 'out_invoice';
  const journal = db.journals.find(j => j.code === TYPE_INFO[entryType].code);
  if (!journal) fail('Chưa cấu hình sổ nhật ký cho loại hóa đơn này.');
  let seq = 0;
  const side = (amount, debitSide) => (debitSide ? { debit: amount, credit: 0 } : { debit: 0, credit: amount });
  const items = [];

  computed.lines.forEach(l => {
    const product = db.products.find(p => p.id === Number(l.productId));
    items.push({
      id: ++seq, displayType: 'product', accountCode: journal.defaultAccount,
      label: product ? product.name : '', productId: Number(l.productId), quantity: Number(l.quantity),
      priceUnit: Number(l.priceUnit), taxId: Number(l.taxId),
      ...side(l.subtotal, !isSale), reconciled: false
    });
  });

  computed.taxGroups.forEach(g => {
    if (g.amount === 0) return;
    items.push({
      id: ++seq, displayType: 'tax', accountCode: g.tax.accountCode, label: g.tax.name, taxId: g.tax.id,
      ...side(g.amount, !isSale), reconciled: false
    });
  });

  items.push({
    id: ++seq, displayType: 'payment_term', accountCode: journal.counterpartAccount,
    label: isSale ? 'Phải thu khách hàng' : 'Phải trả nhà cung cấp',
    ...side(computed.amountTotal, isSale), reconciled: false
  });
  return items;
};

export const sumItems = (items) => ({
  debit: items.reduce((s, it) => s + it.debit, 0),
  credit: items.reduce((s, it) => s + it.credit, 0)
});
