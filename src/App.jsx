import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout, { AdminOnly } from './components/Layout/Layout';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import InvoiceList from './pages/InvoiceList';
import SalesInvoiceForm from './pages/SalesInvoiceForm';
import Payments from './pages/Payments';
import JournalEntries from './pages/JournalEntries';
import Reports from './pages/Reports';
import PartnerLedger from './pages/PartnerLedger';
import Partners from './pages/Partners';
import Products from './pages/Products';
import Taxes from './pages/Taxes';
import AccountingConfig from './pages/AccountingConfig';
import Users from './pages/admin/Users';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />

        <Route path="invoices" element={<InvoiceList type="out_invoice" />} />
        <Route path="invoices/new" element={<SalesInvoiceForm key="new-inv" />} />
        <Route path="invoices/:id" element={<SalesInvoiceForm />} />
        <Route path="bills" element={<InvoiceList type="in_invoice" />} />
        <Route path="bills/new" element={<SalesInvoiceForm key="new-bill" type="in_invoice" />} />
        <Route path="bills/:id" element={<SalesInvoiceForm type="in_invoice" />} />

        <Route path="payments" element={<Payments />} />
        <Route path="journal-entries" element={<JournalEntries />} />
        <Route path="reports" element={<Reports />} />
        <Route path="partner-ledger" element={<PartnerLedger />} />

        <Route path="partners" element={<Partners />} />
        <Route path="products" element={<Products />} />
        <Route path="taxes" element={<Taxes />} />
        <Route path="config" element={<AccountingConfig />} />

        <Route path="admin/users" element={<AdminOnly><Users /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
