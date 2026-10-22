// Sổ cái đối tác (kiểu Odoo): nhóm các dòng công nợ 131/331 của bút toán đã ghi sổ theo đối tác.
// Đối tác của dòng lấy qua bút toán (Journal_Entry.partner_id, REP-04).
// Số dư = Nợ − Có: dương là khách hàng còn nợ mình, âm là mình còn nợ nhà cung cấp.

const NO_PARTNER = 'none';

/**
 * entries: dữ liệu từ GET /journal-entries
 * options:
 *   from, to          kỳ báo cáo (YYYY-MM-DD), có thể bỏ trống
 *   accountCodes      ví dụ ['131', '331']
 *   unreconciledOnly  chỉ lấy dòng chưa khớp
 *   search            lọc theo tên đối tác
 *   dueDates          { [entryId]: 'YYYY-MM-DD' } hạn thanh toán của hóa đơn
 *   matchOf           { [entryId]: 'INV/2026/0001' } chứng từ đã khớp với dòng
 */
export function buildPartnerLedger(entries, {
  from = '', to = '', accountCodes = ['131', '331'], unreconciledOnly = false, search = '', dueDates = {}, matchOf = {}
} = {}) {
  const groups = new Map();
  const s = search.trim().toLowerCase();

  for (const e of entries || []) {
    if (e.state !== 'posted' || !e.date) continue;
    if (to && e.date > to) continue;
    const partnerName = e.partnerName || 'Không có đối tác';
    if (s && !partnerName.toLowerCase().includes(s)) continue;
    for (const item of e.items || []) {
      if (!accountCodes.includes(item.accountCode)) continue;
      if (unreconciledOnly && item.reconciled) continue;
      const key = e.partnerId ?? NO_PARTNER;
      if (!groups.has(key)) groups.set(key, { partnerId: e.partnerId ?? null, partnerName, all: [] });
      groups.get(key).all.push({
        key: `${e.id}-${item.id}`,
        entryId: e.id,
        entryName: e.name,
        entryType: e.entryType,
        journalCode: e.journalCode,
        accountCode: item.accountCode,
        date: e.date,
        dueDate: item.displayType === 'payment_term' ? dueDates[e.id] || null : null,
        matching: item.reconciled ? matchOf[e.id] || 'Đã khớp' : '',
        reconciled: !!item.reconciled,
        label: item.label,
        itemId: item.id,
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0
      });
    }
  }

  const partners = [];
  for (const g of groups.values()) {
    g.all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.entryId - b.entryId || a.itemId - b.itemId));
    const before = g.all.filter(l => from && l.date < from);
    const inPeriod = g.all.filter(l => !from || l.date >= from);
    const opening = before.reduce((sum, l) => sum + l.debit - l.credit, 0);
    let running = opening;
    const lines = inPeriod.map(l => { running += l.debit - l.credit; return { ...l, balance: running }; });
    const debit = inPeriod.reduce((sum, l) => sum + l.debit, 0);
    const credit = inPeriod.reduce((sum, l) => sum + l.credit, 0);
    if (lines.length === 0 && opening === 0) continue;
    partners.push({ partnerId: g.partnerId, partnerName: g.partnerName, opening, debit, credit, closing: running, lines });
  }
  partners.sort((a, b) => a.partnerName.localeCompare(b.partnerName, 'vi'));

  const totals = partners.reduce((t, p) => ({
    opening: t.opening + p.opening, debit: t.debit + p.debit, credit: t.credit + p.credit, closing: t.closing + p.closing
  }), { opening: 0, debit: 0, credit: 0, closing: 0 });
  return { partners, totals };
}

// Có bút toán chưa ghi sổ (nháp) trước hoặc trong kỳ không — để hiện cảnh báo như Odoo.
export const hasDraftEntries = (entries, to = '') =>
  (entries || []).some(e => e.state === 'draft' && (!to || (e.date && e.date <= to)));

// Kỳ báo cáo theo lựa chọn nhanh.
export function periodOf(preset, today, custom = {}) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  switch (preset) {
    case 'this_year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'this_month': return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
    case 'last_month': {
      const yy = m === 1 ? y - 1 : y; const mm = m === 1 ? 12 : m - 1;
      return { from: `${yy}-${pad(mm)}-01`, to: `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}` };
    }
    case 'custom': return { from: custom.from || '', to: custom.to || '' };
    default: return { from: '', to: '' };
  }
}
