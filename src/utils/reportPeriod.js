import { addDays, daysBetween } from './format.js';

// Tuần lịch từ thứ Hai đến Chủ nhật; chuỗi ngày không phụ thuộc múi giờ UTC.
export function reportPeriod(mode, value) {
  if (mode === 'all') return null;
  if (!value) return undefined;
  if (mode === 'day') return { from: value, to: value };
  if (mode === 'week') {
    const [year, month, day] = value.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const from = addDays(value, -((weekday + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  if (mode === 'month') {
    const [year, month] = value.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${value}-01`, to: `${value}-${String(last).padStart(2, '0')}` };
  }
  return undefined;
}

export function invoicesAsOf(invoices, payments, asOf, kind = '') {
  const paidIds = new Set(payments.filter(p => p.paymentDate <= asOf).map(p => p.invoiceId));
  return invoices.filter(i => i.state === 'posted' && i.accountingDate && i.accountingDate <= asOf &&
    (!kind || i.entryType === kind) && !paidIds.has(i.id));
}

export function overdueAsOf(invoices, asOf) {
  return invoices.filter(i => i.invoiceDateDue && i.invoiceDateDue < asOf)
    .map(i => ({ ...i, overdueDays: daysBetween(i.invoiceDateDue, asOf) }));
}
