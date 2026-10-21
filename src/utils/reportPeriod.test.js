import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPeriod, invoicesAsOf, overdueAsOf } from './reportPeriod.js';

test('day, Monday-to-Sunday week and calendar month ranges', () => {
  assert.deepEqual(reportPeriod('day', '2026-01-31'), { from: '2026-01-31', to: '2026-01-31' });
  assert.deepEqual(reportPeriod('week', '2026-01-01'), { from: '2025-12-29', to: '2026-01-04' });
  assert.deepEqual(reportPeriod('month', '2024-02'), { from: '2024-02-01', to: '2024-02-29' });
  assert.equal(reportPeriod('month', ''), undefined);
  assert.equal(reportPeriod('all', ''), null);
});

test('as-of uses accounting date and the payment date, including older invoices', () => {
  const invoices = [
    { id: 1, state: 'posted', entryType: 'out_invoice', accountingDate: '2025-12-01', invoiceDateDue: '2026-01-30', paymentState: 'paid' },
    { id: 2, state: 'posted', entryType: 'in_invoice', accountingDate: '2026-01-31', invoiceDateDue: '2026-01-31' },
    { id: 3, state: 'draft', entryType: 'out_invoice', accountingDate: '2026-01-01' },
    { id: 4, state: 'posted', entryType: 'out_invoice', accountingDate: '2026-02-01' }
  ];
  const payments = [{ invoiceId: 1, paymentDate: '2026-02-01' }, { invoiceId: 2, paymentDate: '2026-01-31' }];
  const unpaid = invoicesAsOf(invoices, payments, '2026-01-31');
  assert.deepEqual(unpaid.map(i => i.id), [1]);
  assert.equal(overdueAsOf(unpaid, '2026-01-31')[0].overdueDays, 1);
  assert.deepEqual(invoicesAsOf(invoices, payments, '2026-02-01'), [invoices[3]]);
  assert.deepEqual(overdueAsOf([invoices[1]], '2026-01-31'), []);
});
