import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import EntryTable from '../components/common/EntryTable';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';

export default function PaymentDetail() {
  const { id } = useParams();
  const { request, downloadPaymentPdf, showToast } = useApp();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPayment(null); setError('');
    request(`/payments/${encodeURIComponent(id)}`)
      .then(result => { if (!cancelled) setPayment(result); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id, reload]);

  const downloadPdf = async () => {
    if (!payment || downloading) return;
    setDownloading(true);
    try {
      await downloadPaymentPdf(payment.id, payment.paymentType);
      showToast(`Đã tải PDF ${payment.paymentType === 'inbound' ? 'phiếu thu' : 'phiếu chi'} ${payment.name}.`);
    } catch (err) { showToast(err.message, 'warning'); }
    finally { setDownloading(false); }
  };

  const isReceipt = payment?.paymentType === 'inbound';
  const invoiceUrl = payment && `${payment.invoiceType === 'in_invoice' ? '/bills' : '/invoices'}/${payment.invoiceId}`;
  const voucherType = payment ? (isReceipt ? 'Phiếu thu' : 'Phiếu chi') : 'Phiếu thu/chi';

  return <div className="o-page">
    <PageHeader
      breadcrumb={<><Link to="/payments">Thu chi</Link> / Chi tiết</>}
      title={`${voucherType}${payment?.name ? ` ${payment.name}` : ''}`}
      actions={payment && <button type="button" className="o-btn o-btn-primary" disabled={downloading}
        onClick={downloadPdf}>{downloading ? 'Đang tải PDF…' : 'Tải PDF'}</button>}
    />

    {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
    {!payment && !error && <p>Đang tải chi tiết phiếu thu/chi từ SQL Server…</p>}
    {payment && <div className="o-stack">
      <section className="o-card" aria-label="Thông tin phiếu">
        <div className="o-card-head">
          <h2 className="o-card-title">Thông tin phiếu</h2>
          <div className="o-row-actions"><StatusBadge status={payment.state} /><StatusBadge status={payment.reconciled ? 'reconciled' : 'open'} /></div>
        </div>
        <div className="o-grid-2">
          <div>
            <p className="o-label">Số tiền {isReceipt ? 'thu' : 'chi'}</p>
            <div className="o-tile-value num">{formatCurrency(payment.amount)}</div>
            {payment.amountWords && <p className="text-muted">Bằng chữ: {payment.amountWords}</p>}
          </div>
          <dl className="o-dl">
            <dt>Số phiếu</dt><dd><strong>{payment.name}</strong></dd>
            <dt>Ngày {isReceipt ? 'thu' : 'chi'}</dt><dd>{formatDate(payment.paymentDate)}</dd>
            <dt>Thời điểm lập</dt><dd>{formatDateTime(payment.createdAt)}</dd>
            <dt>Người lập</dt><dd>{payment.createdBy?.name || '—'}</dd>
            <dt>Sổ</dt><dd>{payment.journal?.code || '—'}{payment.journal?.name ? ` · ${payment.journal.name}` : ''}</dd>
            {payment.journal?.code === 'CSH' && <><dt>Hình thức</dt><dd>Tiền mặt</dd></>}
          </dl>
        </div>
      </section>

      <div className="o-grid-2">
        <section className="o-card" aria-label="Đối tác">
          <h2 className="o-card-title">Đối tác</h2>
          <dl className="o-dl">
            <dt>{isReceipt ? 'Khách hàng' : 'Nhà cung cấp'}</dt><dd>{payment.partner?.name || '—'}</dd>
            {payment.partnerVat && <><dt>MST</dt><dd>{payment.partnerVat}</dd></>}
            {payment.partnerAddress && <><dt>Địa chỉ</dt><dd>{payment.partnerAddress}</dd></>}
          </dl>
        </section>
        <section className="o-card" aria-label="Hóa đơn liên quan">
          <h2 className="o-card-title">Hóa đơn liên quan</h2>
          <dl className="o-dl">
            <dt>Số hóa đơn</dt><dd><Link to={invoiceUrl}>{payment.invoiceName || 'Xem hóa đơn'}</Link></dd>
            <dt>Lý do {isReceipt ? 'thu' : 'chi'}</dt><dd>{payment.reason}</dd>
          </dl>
        </section>
      </div>

      <section className="o-card" aria-label="Hạch toán phiếu thu chi">
        <div className="o-card-head">
          <h2 className="o-card-title">Hạch toán</h2>
          <Link to={`/journal-entries/${payment.entryId}`}>Xem bút toán</Link>
        </div>
        <EntryTable title={payment.name} subtitle={`Sổ ${payment.journal?.code || '—'}`}
          partnerName={payment.partner?.name} items={payment.items || []}
          accountName={code => payment.items?.find(item => item.accountCode === code)?.accountName || ''} />
      </section>
    </div>}
  </div>;
}
