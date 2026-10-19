# API and DTO contract - SQL Server v5 + approved migration

This document is the frontend/backend contract for replacing browser `localStorage`
with Spring Boot and SQL Server. It follows `invoicing_schema_sqlserver_v5.sql`
plus `database/migrations/20261019_01_partner_notes.sql`.

## Principles

- API paths are rooted at `/api`.
- Dates use `YYYY-MM-DD`; monetary values are JSON numbers with two decimal
  places; identifiers are numeric SQL Server identities.
- Requests use `Authorization: Bearer <access-token>` except login. The backend
  derives totals, accounting accounts, payment type, document number, partner
  and payment amount; clients must not send those as authoritative values.
- `admin` may read all operational data and manage users. `accountant` may read
  all operational data and create/update allowed master data, invoices and cash
  payments.
- A `Partner` has exactly one role because the UI keeps a single dropdown:
  `customer` maps to `is_customer=1,is_supplier=0`; `supplier` maps to
  `is_customer=0,is_supplier=1`.

## Common response types

### AccountDto

```json
{ "id": 2, "code": "131", "name": "Phải thu khách hàng", "accountType": "receivable", "reconcile": true }
```

### JournalDto

`counterpartAccount` is a display-only, server-derived field. It is not a
column in `Journal`.

```json
{
  "id": 1,
  "code": "INV",
  "name": "Hóa đơn bán",
  "type": "sale",
  "defaultAccount": { "id": 4, "code": "511", "name": "Doanh thu bán hàng" },
  "counterpartAccount": { "id": 2, "code": "131", "name": "Phải thu khách hàng" }
}
```

### PartnerDto

```json
{
  "id": 1,
  "name": "Công ty ABC",
  "partnerType": "customer",
  "vat": "0312345678",
  "email": "ketoan@abc.vn",
  "phone": "0901234567",
  "address": "123 Nguyễn Văn Linh",
  "city": "Hà Nội",
  "active": true
}
```

`partnerType` is a transport/UI field mapped to the two database flags; it is
not a new database column.

### ProductDto and ProductCategoryDto

```json
{
  "id": 1,
  "code": "BP-001",
  "name": "Bàn phím cơ",
  "categoryId": 1,
  "uom": "Cái",
  "salePrice": 500000.00,
  "costPrice": 350000.00,
  "saleTaxId": 1,
  "purchaseTaxId": 2,
  "active": true
}
```

```json
{
  "id": 1,
  "name": "Phụ kiện máy tính",
  "salesAccountId": 4,
  "purchaseAccountId": 5
}
```

### TaxDto

```json
{
  "id": 1,
  "name": "VAT bán 10%",
  "amount": 10.0000,
  "typeTaxUse": "sale",
  "account": { "id": 6, "code": "3331", "name": "Thuế GTGT phải nộp" }
}
```

### InvoiceDto

The database record is `Journal_Entry`; this DTO is used for both
`out_invoice` and `in_invoice`.

```json
{
  "id": 41,
  "name": "INV/2026/0001",
  "entryType": "out_invoice",
  "state": "posted",
  "journal": { "id": 1, "code": "INV", "name": "Hóa đơn bán" },
  "partner": { "id": 1, "name": "Công ty ABC", "partnerType": "customer" },
  "createdBy": { "id": 2, "userName": "ketoan", "fullName": "Trần Thị B" },
  "invoiceDate": "2026-10-02",
  "invoiceDateDue": "2026-11-01",
  "accountingDate": "2026-10-02",
  "amountUntaxed": 1900000.00,
  "amountTax": 190000.00,
  "amountTotal": 2090000.00,
  "paymentState": "not_paid",
  "notes": "Giao hàng tại kho Hà Nội",
  "createdAt": "2026-10-02T09:15:00",
  "lines": [],
  "items": []
}
```

`lines` contains only `Journal_Item` rows whose `display_type` is `product`.
`items` contains every accounting row for the entry, including tax and payment
term rows. `accountingDate` maps to `[date]` in SQL Server.

### PaymentDto

`Payment` does not contain a document number, partner or creator. The API
joins `Payment.entry_id` to its `Journal_Entry` and returns a UI-friendly DTO.

```json
{
  "id": 5,
  "entryId": 42,
  "invoiceId": 41,
  "name": "CSH/2026/0001",
  "paymentType": "inbound",
  "amount": 2090000.00,
  "paymentDate": "2026-10-04",
  "journal": { "id": 3, "code": "CSH", "name": "Tiền mặt" },
  "partner": { "id": 1, "name": "Công ty ABC" },
  "createdBy": { "id": 2, "userName": "ketoan", "fullName": "Trần Thị B" },
  "invoiceName": "INV/2026/0001"
}
```

## Request DTOs and endpoints

### Authentication and users

| Method and path | Role | Request |
| --- | --- | --- |
| `POST /auth/login` | Public | `{ "identifier", "password" }` |
| `GET /auth/me` | Authenticated | — |
| `POST /auth/change-password` | Authenticated | `{ "oldPassword", "newPassword" }` |
| `GET /users` | Admin | — |
| `POST /users/accountants` | Admin | `{ "userName", "fullName", "email", "password" }` |
| `PATCH /users/{id}/active` | Admin | `{ "active": true }` |
| `POST /users/{id}/reset-password` | Admin | `{ "newPassword" }` |

### Master data

| Resource | Read | Create/update | Other operations |
| --- | --- | --- | --- |
| Partners | `GET /partners?type=customer|supplier&active=true|false` | `POST /partners`, `PUT /partners/{id}` with `PartnerDto` fields except `id`, `active` | `PATCH /partners/{id}/active`; `DELETE /partners/{id}` only if unused |
| Products | `GET /products`, `GET /products/{id}` | `POST /products`, `PUT /products/{id}` with `code`, `name`, `categoryId`, `uom`, `salePrice`, `costPrice`, `saleTaxId`, `purchaseTaxId` | `PATCH /products/{id}/active`; delete only if unused |
| Categories | `GET /product-categories` | `POST`/`PUT /product-categories` with `name`, `salesAccountId`, `purchaseAccountId` | delete only when no product references it |
| Taxes | `GET /taxes?use=sale|purchase` | `POST /taxes`, `PUT /taxes/{id}` with `name`, `amount`, `typeTaxUse`, `accountId` | delete only when unused and not a product default |
| Accounting configuration | `GET /accounts`, `GET /journals`, `GET /accounting-config` | Read-only in this phase | — |

All master-data writes require `accountant`, except the user endpoints above.

### Invoice writes

`POST /invoices/sales` and `POST /invoices/purchases` create draft entries.
`PUT /invoices/{id}` edits a draft of its existing type.

```json
{
  "partnerId": 1,
  "invoiceDate": "2026-10-02",
  "invoiceDateDue": "2026-11-01",
  "accountingDate": "2026-10-02",
  "notes": "Giao hàng tại kho Hà Nội",
  "lines": [
    { "productId": 1, "quantity": 2.000, "priceUnit": 500000.00, "taxId": 1 }
  ]
}
```

| Method and path | Effect |
| --- | --- |
| `GET /invoices?type=out_invoice|in_invoice&state=&paymentState=` | Paginated invoice list |
| `GET /invoices/{id}` | Full `InvoiceDto` |
| `POST /invoices/sales` | Create `out_invoice` draft; Partner must be customer |
| `POST /invoices/purchases` | Create `in_invoice` draft; Partner must be supplier |
| `PUT /invoices/{id}` | Replace editable header/product lines of a draft |
| `POST /invoices/{id}/post` | Validate and post; assign `Journal_Entry.name` |
| `POST /invoices/{id}/reset-to-draft` | Only posted, unpaid invoice |
| `POST /invoices/{id}/cancel` | Only draft invoice |

### Cash payments

```json
{ "invoiceId": 41, "paymentDate": "2026-10-04" }
```

| Method and path | Effect |
| --- | --- |
| `GET /payments?type=inbound|outbound` | Payment list using `PaymentDto` |
| `POST /payments` | Create a complete, one-time cash payment for a posted unpaid invoice |

The service derives inbound/outbound, payment amount, partner, `CSH` journal and
the payment journal entry. No memo is accepted because the approved DDL has no
column for it.

### Ledger and reports

| Method and path | Result |
| --- | --- |
| `GET /journal-entries?journalId=&state=` | Journal entries plus item rows |
| `GET /reports/unpaid-invoices?type=` | Posted, unpaid invoice DTOs |
| `GET /reports/debts` | Open 131 and 331 balances grouped by Partner |
| `GET /reports/payments` | Cash receipts/disbursements and totals |
| `GET /reports/overdue-invoices?type=&asOfDate=` | Posted, unpaid invoices overdue at the requested date |

## Mandatory accounting rules in the service layer

All invoice posting and payment creation is one database transaction.

1. Product lines use the Product Category sale/purchase account when it is not
   null; otherwise they use `Journal.default_account_id`.
2. Tax rows use `Tax.account_id` and aggregate amounts by tax id.
3. The counterpart account is the reconciliable Account with `code=131` for a
   sale and `code=331` for a purchase. It is only derived for display and
   posting; it is not stored on `Journal`.
4. A sale posts credit revenue/tax and debit 131. A purchase posts debit
   inventory/tax and credit 331.
5. A payment uses the journal whose `code` is `CSH`, pays exactly the invoice
   total once, creates its own `Journal_Entry`, updates the invoice to `paid`,
   and marks the two 131/331 payment-term rows reconciled.
6. `Journal_Item.display_type` is one of the SQL values: `product`, `tax`,
   `payment_term`, `cash`. Never use the old UI value `liquidity`.
7. A document number is allocated inside the transaction by journal code and
   accounting-date year. Payment entries use the `CSH` sequence.

