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
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) return undefined;
    const [year, month] = value.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${value}-01`, to: `${value}-${String(last).padStart(2, '0')}` };
  }
  if (mode === 'year') {
    if (!/^[1-9]\d{3}$/.test(value)) return undefined;
    return { from: `${value}-01-01`, to: `${value}-12-31` };
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
