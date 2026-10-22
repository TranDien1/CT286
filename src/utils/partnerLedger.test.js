import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPartnerLedger, hasDraftEntries, periodOf } from './partnerLedger.js';

// Ví dụ trong "Hoa don ban.pdf" và "Hoa don mua.pdf", thêm một hóa đơn chưa thu và một bút toán nháp
const entries = [
  { id: 1, name: 'INV/2026/0001', entryType: 'out_invoice', state: 'posted', date: '2026-10-02', journalCode: 'INV', partnerId: 1, partnerName: 'Công ty ABC', items: [
    { id: 1, accountCode: '511', debit: 0, credit: 1900000 },
    { id: 3, accountCode: '3331', debit: 0, credit: 190000 },
    { id: 4, accountCode: '131', displayType: 'payment_term', label: 'Phải thu khách hàng', debit: 2090000, credit: 0, reconciled: true }
  ] },
  { id: 2, name: 'CSH/2026/0001', entryType: 'entry', state: 'posted', date: '2026-10-02', journalCode: 'CSH', partnerId: 1, partnerName: 'Công ty ABC', items: [
    { id: 5, accountCode: '111', debit: 2090000, credit: 0 },
    { id: 6, accountCode: '131', displayType: 'payment_term', label: 'Tất toán INV/2026/0001', debit: 0, credit: 2090000, reconciled: true }
  ] },
  { id: 3, name: 'BILL/2026/0001', entryType: 'in_invoice', state: 'posted', date: '2026-10-03', journalCode: 'BILL', partnerId: 2, partnerName: 'Công ty XYZ', items: [
    { id: 10, accountCode: '331', displayType: 'payment_term', debit: 0, credit: 8250000, reconciled: false }
  ] },
  { id: 5, name: 'INV/2026/0002', entryType: 'out_invoice', state: 'posted', date: '2026-11-05', journalCode: 'INV', partnerId: 1, partnerName: 'Công ty ABC', items: [
    { id: 20, accountCode: '131', displayType: 'payment_term', debit: 1100000, credit: 0, reconciled: false }
  ] },
  { id: 6, name: null, entryType: 'out_invoice', state: 'draft', date: '2026-10-20', partnerId: 1, partnerName: 'Công ty ABC', items: [
    { id: 30, accountCode: '131', debit: 500000, credit: 0 }
  ] }
];
const matchOf = { 1: 'INV/2026/0001', 2: 'INV/2026/0001' };
const dueDates = { 1: '2026-11-01', 3: '2026-10-18', 5: '2026-12-05' };

test('groups by partner, Nợ − Có balance, drafts ignored', () => {
  const r = buildPartnerLedger(entries, { matchOf, dueDates });
  assert.deepEqual(r.partners.map(p => [p.partnerName, p.debit, p.credit, p.closing]),
    [['Công ty ABC', 3190000, 2090000, 1100000], ['Công ty XYZ', 0, 8250000, -8250000]]);
  assert.deepEqual(r.totals, { opening: 0, debit: 3190000, credit: 10340000, closing: -7150000 });
  const abc = r.partners[0];
  assert.deepEqual(abc.lines.map(l => [l.entryName, l.balance, l.matching, l.dueDate]),
    [['INV/2026/0001', 2090000, 'INV/2026/0001', '2026-11-01'], ['CSH/2026/0001', 0, 'INV/2026/0001', null], ['INV/2026/0002', 1100000, '', '2026-12-05']]);
});

test('period: earlier lines go to opening balance, later lines excluded', () => {
  const r = buildPartnerLedger(entries, { from: '2026-11-01', to: '2026-11-30' });
  const abc = r.partners.find(p => p.partnerId === 1);
  assert.equal(abc.opening, 0);
  assert.equal(abc.lines.length, 1);
  const xyz = r.partners.find(p => p.partnerId === 2);
  assert.equal(xyz.opening, -8250000);
  assert.equal(xyz.lines.length, 0);
  assert.equal(xyz.closing, -8250000);
});

test('account filter, unreconciled only and search', () => {
  assert.deepEqual(buildPartnerLedger(entries, { accountCodes: ['331'] }).partners.map(p => p.partnerName), ['Công ty XYZ']);
  const open = buildPartnerLedger(entries, { unreconciledOnly: true });
  assert.equal(open.partners.find(p => p.partnerId === 1).lines.length, 1);
  assert.deepEqual(buildPartnerLedger(entries, { search: 'xyz' }).partners.map(p => p.partnerId), [2]);
});

test('draft warning and period presets', () => {
  assert.equal(hasDraftEntries(entries, '2026-10-31'), true);
  assert.equal(hasDraftEntries(entries, '2026-10-10'), false);
  assert.deepEqual(periodOf('this_year', '2026-10-22'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(periodOf('last_month', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(periodOf('all', '2026-10-22'), { from: '', to: '' });
});
