// Truy vấn cho danh sách và báo cáo (REP-01 → REP-06). Chỉ đọc, không thay đổi dữ liệu.
import { isOverdue, overdueDays, TYPE_INFO } from './rules';
import { todayStr } from '../utils/format';

export const partnerOf = (db, entry) => db.partners.find(p => p.id === entry.partnerId);

// REP-04: tên đối tác của dòng bút toán lấy qua entry → Journal_Entry.partner_id → Partner
export const allEntries = (db) => [
  ...db.invoices.map(inv => ({
    id: `inv-${inv.id}`, ref: inv, kind: 'invoice', name: inv.name, entryType: inv.entryType,
    journalCode: inv.journalCode, partnerId: inv.partnerId, date: inv.date, state: inv.state, items: inv.items
  })),
  ...db.paymentEntries.map(e => ({
    id: `pay-${e.id}`, ref: e, kind: 'payment', name: e.name, entryType: 'entry',
    journalCode: e.journalCode, partnerId: e.partnerId, date: e.date, state: e.state, items: e.items
  }))
];

// REP-02: hóa đơn đã ghi sổ và chưa thanh toán
export const unpaidInvoices = (db, entryType) =>
  db.invoices.filter(i => (!entryType || i.entryType === entryType) && i.state === 'posted' && i.paymentState === 'not_paid');

// REP-06 theo DATE-05 → DATE-07
export const overdueInvoices = (db, entryType, today = todayStr()) =>
  db.invoices
    .filter(i => (!entryType || i.entryType === entryType) && isOverdue(i, today))
    .map(i => ({ ...i, overdueDays: overdueDays(i, today) }));

/**
 * REP-03: công nợ dựa trên các dòng công nợ chưa đối soát (reconciled = 0)
 * của bút toán đã ghi sổ, nhóm theo đối tác (lấy qua bút toán).
 */
export const openDebts = (db, accountCode) => {
  const rows = {};
  allEntries(db)
    .filter(e => e.state === 'posted')
    .forEach(e => {
      e.items
        .filter(it => it.accountCode === accountCode && !it.reconciled)
        .forEach(it => {
          const key = e.partnerId;
          rows[key] = rows[key] || { partnerId: key, debit: 0, credit: 0, entries: [] };
          rows[key].debit += it.debit;
          rows[key].credit += it.credit;
          rows[key].entries.push(e.name);
        });
    });
  return Object.values(rows)
    .map(r => ({ ...r, partner: db.partners.find(p => p.id === r.partnerId), balance: Math.abs(r.debit - r.credit) }))
    .sort((a, b) => b.balance - a.balance);
};

// REP-05: phiếu thu/chi với số chứng từ, đối tác, hóa đơn liên quan, số tiền, ngày
export const paymentReport = (db, paymentType) =>
  db.payments
    .filter(p => !paymentType || p.paymentType === paymentType)
    .map(p => ({
      ...p,
      partner: db.partners.find(x => x.id === p.partnerId),
      invoice: db.invoices.find(i => i.id === p.invoiceId)
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

export const invoiceStatusKey = (inv, today = todayStr()) => {
  if (inv.state === 'draft') return 'draft';
  if (inv.state === 'cancel') return 'cancel';
  if (inv.paymentState === 'paid') return 'paid';
  return isOverdue(inv, today) ? 'overdue' : 'not_paid';
};

export const invoicePath = (inv) => `${TYPE_INFO[inv.entryType].path}/${inv.id}`;
