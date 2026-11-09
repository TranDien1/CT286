import { reportPeriod } from './reportPeriod.js';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function periodOf(preset, today, custom = {}) {
  const [year, month] = today.split('-').map(Number);
  if (preset === 'custom') return { from: custom.from || '', to: custom.to || '' };
  if (preset === 'all') return { from: '', to: '' };
  if (['day', 'week', 'month', 'year'].includes(preset)) return reportPeriod(preset, custom[preset]);
  if (preset === 'this_year' || preset === 'last_year') {
    const y = year - (preset === 'last_year' ? 1 : 0);
    return { from: `${y}-01-01`, to: preset === 'this_year' ? today : `${y}-12-31` };
  }
  const offset = preset === 'last_month' ? -1 : 0;
  return { from: iso(new Date(year, month - 1 + offset, 1)), to: preset === 'this_month' ? today : iso(new Date(year, month + offset, 0)) };
}

export const hasDraftEntries = (entries, to) => entries.some(e => e.state === 'draft' && (!to || e.date <= to) && e.items.some(i => ['131', '331'].includes(i.accountCode)));

export function buildPartnerLedger(entries, { from, to, accountCodes, unreconciledOnly, search, dueDates, matchOf, payments }) {
  const groups = new Map();
  const hasPayments = Array.isArray(payments);
  const paymentDates = new Map((payments || []).map(p => [Number(p.invoiceId), p.paymentDate]));
  const needle = (search || '').trim().toLocaleLowerCase('vi');
  const sorted = [...entries].filter(e => e.state === 'posted' && (!to || e.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  for (const entry of sorted) {
    const name = entry.partnerName || 'Không có đối tác';
    if (needle && !name.toLocaleLowerCase('vi').includes(needle)) continue;
    const key = entry.partnerId ?? 'none';
    for (const item of entry.items) {
      if (!accountCodes.includes(item.accountCode)) continue;
      const invoiceDebt = ['out_invoice', 'in_invoice'].includes(entry.entryType) &&
        ['131', '331'].includes(item.accountCode) && (!item.displayType || item.displayType === 'payment_term');
      const paidDate = paymentDates.get(entry.id);
      const reconciledAsOf = invoiceDebt && hasPayments && to
        ? Boolean(paidDate && paidDate <= to) : item.reconciled;
      if (unreconciledOnly && (!invoiceDebt || reconciledAsOf)) continue;
      if (!groups.has(key)) groups.set(key, { partnerId: entry.partnerId, partnerName: name, opening: 0, debit: 0, credit: 0, lines: [] });
      const group = groups.get(key);
      const debit = Number(item.debit) || 0, credit = Number(item.credit) || 0;
      if (from && entry.date < from) { group.opening += debit - credit; continue; }
      group.debit += debit; group.credit += credit;
      group.lines.push({ key: `${entry.id}-${item.id}`, entryId: entry.id, entryType: entry.entryType, entryName: entry.name || 'Chưa có số', journalCode: entry.journalCode, accountCode: item.accountCode, date: entry.date, dueDate: dueDates[entry.id], matching: reconciledAsOf ? (matchOf[entry.id] || 'Đã đối soát') : 'Chưa đối soát', label: item.label, debit, credit });
    }
  }
  const partners = [...groups.values()].map(p => {
    let balance = p.opening;
    for (const line of p.lines) { balance += line.debit - line.credit; line.balance = balance; }
    return { ...p, closing: balance };
  }).sort((a, b) => a.partnerName.localeCompare(b.partnerName, 'vi'));
  return { partners, totals: partners.reduce((sum, p) => ({ debit: sum.debit + p.debit, credit: sum.credit + p.credit, closing: sum.closing + p.closing }), { debit: 0, credit: 0, closing: 0 }) };
}
