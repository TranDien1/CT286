// Nhóm phiếu theo ngày thanh toán, từ đầu tháng thứ 12 đến hết hôm nay.
export function paymentTrend(payments, today) {
  const [year, month] = today.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, month - 12 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, inbound: 0, outbound: 0 };
  });
  const byMonth = new Map(months.map(row => [row.key, row]));
  for (const payment of payments) {
    const row = byMonth.get(payment.paymentDate?.slice(0, 7));
    if (row && payment.paymentDate <= today && (payment.paymentType === 'inbound' || payment.paymentType === 'outbound')) {
      row[payment.paymentType] += Number(payment.amount) || 0;
    }
  }
  return months;
}
