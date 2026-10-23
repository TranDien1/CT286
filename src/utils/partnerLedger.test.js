import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPartnerLedger, periodOf, hasDraftEntries } from './partnerLedger.js';

const rows = [
  { id: 1, state: 'posted', date: '2025-12-20', partnerId: 7, partnerName: 'ABC', entryType: 'out_invoice', name: 'INV/1', journalCode: 'INV', items: [{ id: 1, accountCode: '131', debit: 100, credit: 0, reconciled: true }] },
  { id: 2, state: 'posted', date: '2026-01-05', partnerId: 7, partnerName: 'ABC', entryType: 'entry', name: 'CSH/1', journalCode: 'CSH', items: [{ id: 2, accountCode: '131', debit: 0, credit: 100, reconciled: true }] },
  { id: 3, state: 'posted', date: '2026-01-06', partnerId: 8, partnerName: 'XYZ', entryType: 'in_invoice', name: 'BILL/1', journalCode: 'BILL', items: [{ id: 3, accountCode: '331', debit: 0, credit: 75, reconciled: false }] },
  { id: 4, state: 'draft', date: '2026-01-07', partnerId: 8, partnerName: 'XYZ', items: [{ id: 4, accountCode: '331', debit: 0, credit: 999, reconciled: false }] }
];
const options = { from: '2026-01-01', to: '2026-01-31', accountCodes: ['131','331'], unreconciledOnly: false, search: '', dueDates: {}, matchOf: {} };
test('posted entries produce opening, movements and closing; drafts excluded', () => {
  const r = buildPartnerLedger(rows, options);
  assert.deepEqual([r.partners[0].opening,r.partners[0].credit,r.partners[0].closing], [100,100,0]);
  assert.equal(r.partners[1].closing, -75);
  assert.deepEqual(r.totals, { debit: 0, credit: 175, closing: -75 });
  assert.equal(hasDraftEntries(rows, options.to), true);
});
test('account and current reconciliation filters select only matching items', () => {
  const r = buildPartnerLedger(rows, { ...options, accountCodes: ['331'], unreconciledOnly: true });
  assert.equal(r.partners.length, 1); assert.equal(r.partners[0].closing, -75);
  assert.equal(buildPartnerLedger(rows, { ...options, accountCodes: ['131'], unreconciledOnly: true }).partners.length, 0);
});
test('period presets handle year boundaries and leap years', () => {
  assert.deepEqual(periodOf('last_month', '2024-03-14'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(periodOf('last_month', '2026-01-05'), { from: '2025-12-01', to: '2025-12-31' });
});
