import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTrend } from './paymentTrend.js';

test('groups receipts and payments over 12 calendar months through today', () => {
  const rows = paymentTrend([
    { paymentDate: '2025-11-01', paymentType: 'inbound', amount: 100 },
    { paymentDate: '2025-10-31', paymentType: 'inbound', amount: 500 },
    { paymentDate: '2026-10-21', paymentType: 'inbound', amount: 50 },
    { paymentDate: '2026-10-20', paymentType: 'outbound', amount: 30 },
    { paymentDate: '2026-10-22', paymentType: 'outbound', amount: 900 }
  ], '2026-10-21');
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[0], { key: '2025-11', inbound: 100, outbound: 0 });
  assert.deepEqual(rows[11], { key: '2026-10', inbound: 50, outbound: 30 });
  assert.deepEqual(rows[1], { key: '2025-12', inbound: 0, outbound: 0 });
});
