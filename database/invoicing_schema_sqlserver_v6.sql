/*
  CT286 - Hệ thống quản lý hóa đơn
  SQL Server schema v6

  Cơ sở: invoicing_schema_sqlserver_v5.sql
  Thay đổi đã chốt:
    - Partner có address, city; một đối tác chỉ là khách hàng hoặc nhà cung cấp.
    - Journal_Entry có notes.
    - Không có payment_terms, payment memo, thanh toán một phần hay chuyển khoản.

  Chạy bằng SSMS 22 với quyền CREATE DATABASE.
  Script không xóa hoặc ghi đè database đã tồn tại.
*/

USE master;
GO

IF DB_ID(N'CT286_Invoicing') IS NOT NULL
    THROW 51000, N'Database CT286_Invoicing đã tồn tại. Script không ghi đè database hiện có.', 1;
GO

CREATE DATABASE CT286_Invoicing;
GO

USE CT286_Invoicing;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* =====================================================================
   1. Người dùng
   ===================================================================== */
CREATE TABLE dbo.App_User (
    id            INT IDENTITY(1,1) CONSTRAINT PK_App_User PRIMARY KEY,
    user_name     NVARCHAR(255) NOT NULL CONSTRAINT UQ_App_User_UserName UNIQUE,
    full_name     NVARCHAR(255) NOT NULL,
    email         VARCHAR(255) NULL,
    phone         VARCHAR(32) NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role          VARCHAR(16) NOT NULL
                  CONSTRAINT CK_App_User_Role CHECK (role IN ('admin', 'accountant')),
    active        BIT NOT NULL CONSTRAINT DF_App_User_Active DEFAULT 1
);
GO

/* =====================================================================
   2. Đối tác
   Một dropdown loại đối tác: chính xác một trong hai cờ phải bằng 1.
   ===================================================================== */
CREATE TABLE dbo.Partner (
    id            INT IDENTITY(1,1) CONSTRAINT PK_Partner PRIMARY KEY,
    name          NVARCHAR(255) NOT NULL,
    vat           VARCHAR(32) NULL,                     -- mã số thuế
    email         VARCHAR(255) NULL,
    phone         VARCHAR(32) NULL,
    address       NVARCHAR(255) NULL,
    city          NVARCHAR(128) NULL,
    is_customer   BIT NOT NULL,
    is_supplier   BIT NOT NULL,
    active        BIT NOT NULL CONSTRAINT DF_Partner_Active DEFAULT 1,
    CONSTRAINT CK_Partner_ExactlyOneType CHECK (
        (is_customer = 1 AND is_supplier = 0)
        OR
        (is_customer = 0 AND is_supplier = 1)
    )
);
GO

/* =====================================================================
   3. Hệ thống tài khoản kế toán
   ===================================================================== */
CREATE TABLE dbo.Account (
    id            INT IDENTITY(1,1) CONSTRAINT PK_Account PRIMARY KEY,
    code          VARCHAR(16) NOT NULL CONSTRAINT UQ_Account_Code UNIQUE,
    name          NVARCHAR(255) NOT NULL,
    account_type  VARCHAR(32) NOT NULL,                 -- cash, receivable, payable, income, expense, liability, asset
    reconcile     BIT NOT NULL CONSTRAINT DF_Account_Reconcile DEFAULT 0
);
GO

/* =====================================================================
   4. Sổ nhật ký
   ===================================================================== */
CREATE TABLE dbo.Journal (
    id                  INT IDENTITY(1,1) CONSTRAINT PK_Journal PRIMARY KEY,
    name                NVARCHAR(128) NOT NULL,
    code                VARCHAR(8) NOT NULL CONSTRAINT UQ_Journal_Code UNIQUE, -- INV, BILL, CSH
    type                VARCHAR(16) NOT NULL
                        CONSTRAINT CK_Journal_Type CHECK (type IN ('sale', 'purchase', 'cash', 'general')),
    default_account_id  INT NULL,
    CONSTRAINT FK_Journal_DefaultAccount
        FOREIGN KEY (default_account_id) REFERENCES dbo.Account(id)
);
GO

/* =====================================================================
   5. Thuế
   ===================================================================== */
CREATE TABLE dbo.Tax (
    id              INT IDENTITY(1,1) CONSTRAINT PK_Tax PRIMARY KEY,
    name            NVARCHAR(128) NOT NULL,
    amount          DECIMAL(8,4) NOT NULL,               -- 10 = 10%
    type_tax_use    VARCHAR(16) NOT NULL
                    CONSTRAINT CK_Tax_TypeUse CHECK (type_tax_use IN ('sale', 'purchase')),
    account_id      INT NULL,
    CONSTRAINT FK_Tax_Account
        FOREIGN KEY (account_id) REFERENCES dbo.Account(id)
);
GO

/* =====================================================================
   6. Danh mục sản phẩm
   ===================================================================== */
CREATE TABLE dbo.Product_Category (
    id                  INT IDENTITY(1,1) CONSTRAINT PK_Product_Category PRIMARY KEY,
    name                NVARCHAR(128) NOT NULL,
    sales_account_id    INT NULL,
    purchase_account_id INT NULL,
    CONSTRAINT FK_Product_Category_SalesAccount
        FOREIGN KEY (sales_account_id) REFERENCES dbo.Account(id),
    CONSTRAINT FK_Product_Category_PurchaseAccount
        FOREIGN KEY (purchase_account_id) REFERENCES dbo.Account(id)
);
GO

/* =====================================================================
   7. Sản phẩm
   ===================================================================== */
CREATE TABLE dbo.Product (
    id               INT IDENTITY(1,1) CONSTRAINT PK_Product PRIMARY KEY,
    code             VARCHAR(32) NOT NULL CONSTRAINT UQ_Product_Code UNIQUE,
    name             NVARCHAR(255) NOT NULL,
    category_id      INT NOT NULL,
    uom              NVARCHAR(32) NOT NULL CONSTRAINT DF_Product_Uom DEFAULT N'Cái',
    sale_price       DECIMAL(18,2) NOT NULL CONSTRAINT DF_Product_SalePrice DEFAULT 0,
    cost_price       DECIMAL(18,2) NOT NULL CONSTRAINT DF_Product_CostPrice DEFAULT 0,
    sale_tax_id      INT NULL,
    purchase_tax_id  INT NULL,
    active           BIT NOT NULL CONSTRAINT DF_Product_Active DEFAULT 1,
    CONSTRAINT CK_Product_SalePrice CHECK (sale_price >= 0),
    CONSTRAINT CK_Product_CostPrice CHECK (cost_price >= 0),
    CONSTRAINT FK_Product_Category
        FOREIGN KEY (category_id) REFERENCES dbo.Product_Category(id),
    CONSTRAINT FK_Product_SaleTax
        FOREIGN KEY (sale_tax_id) REFERENCES dbo.Tax(id),
    CONSTRAINT FK_Product_PurchaseTax
        FOREIGN KEY (purchase_tax_id) REFERENCES dbo.Tax(id)
);
GO

/* =====================================================================
   8. Header hóa đơn và bút toán
   notes: ghi chú của hóa đơn/bút toán, không có điều khoản thanh toán.
   ===================================================================== */
CREATE TABLE dbo.Journal_Entry (
    id               INT IDENTITY(1,1) CONSTRAINT PK_Journal_Entry PRIMARY KEY,
    name             VARCHAR(64) NULL,                   -- INV/2026/0001, BILL/2026/0001, CSH/2026/0001
    entry_type       VARCHAR(16) NOT NULL
                     CONSTRAINT CK_Journal_Entry_Type CHECK (entry_type IN ('entry', 'out_invoice', 'in_invoice')),
    state            VARCHAR(16) NOT NULL CONSTRAINT DF_Journal_Entry_State DEFAULT 'draft'
                     CONSTRAINT CK_Journal_Entry_State CHECK (state IN ('draft', 'posted', 'cancel')),
    journal_id       INT NOT NULL,
    partner_id       INT NULL,
    created_by       INT NOT NULL,
    invoice_date     DATE NULL,
    invoice_date_due DATE NULL,
    [date]           DATE NOT NULL CONSTRAINT DF_Journal_Entry_Date DEFAULT CAST(GETDATE() AS DATE),
    amount_untaxed   DECIMAL(18,2) NOT NULL CONSTRAINT DF_Journal_Entry_Untaxed DEFAULT 0,
    amount_tax       DECIMAL(18,2) NOT NULL CONSTRAINT DF_Journal_Entry_Tax DEFAULT 0,
    amount_total     DECIMAL(18,2) NOT NULL CONSTRAINT DF_Journal_Entry_Total DEFAULT 0,
    payment_state    VARCHAR(16) NOT NULL CONSTRAINT DF_Journal_Entry_PaymentState DEFAULT 'not_paid'
                     CONSTRAINT CK_Journal_Entry_PaymentState CHECK (payment_state IN ('not_paid', 'paid')),
    notes            NVARCHAR(1000) NULL,
    created_at       DATETIME2 NOT NULL CONSTRAINT DF_Journal_Entry_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Journal_Entry_Journal
        FOREIGN KEY (journal_id) REFERENCES dbo.Journal(id),
    CONSTRAINT FK_Journal_Entry_Partner
        FOREIGN KEY (partner_id) REFERENCES dbo.Partner(id),
    CONSTRAINT FK_Journal_Entry_CreatedBy
        FOREIGN KEY (created_by) REFERENCES dbo.App_User(id)
);
GO

/* =====================================================================
   9. Dòng bút toán
   ===================================================================== */
CREATE TABLE dbo.Journal_Item (
    id              INT IDENTITY(1,1) CONSTRAINT PK_Journal_Item PRIMARY KEY,
    entry_id        INT NOT NULL,
    account_id      INT NOT NULL,
    product_id      INT NULL,
    tax_id          INT NULL,                             -- chỉ trên dòng product
    name            NVARCHAR(255) NULL,
    display_type    VARCHAR(16) NOT NULL CONSTRAINT DF_Journal_Item_DisplayType DEFAULT 'product'
                    CONSTRAINT CK_Journal_Item_DisplayType CHECK (display_type IN ('product', 'tax', 'payment_term', 'cash')),
    quantity        DECIMAL(12,3) NULL,
    price_unit      DECIMAL(18,2) NULL,
    debit           DECIMAL(18,2) NOT NULL CONSTRAINT DF_Journal_Item_Debit DEFAULT 0,
    credit          DECIMAL(18,2) NOT NULL CONSTRAINT DF_Journal_Item_Credit DEFAULT 0,
    balance         AS (debit - credit) PERSISTED,
    tax_line_id     INT NULL,                             -- loại thuế của dòng tax
    reconciled      BIT NOT NULL CONSTRAINT DF_Journal_Item_Reconciled DEFAULT 0,
    CONSTRAINT CK_Journal_Item_OneSide CHECK (NOT (debit > 0 AND credit > 0)),
    CONSTRAINT CK_Journal_Item_Product CHECK (
        (display_type = 'product' AND product_id IS NOT NULL)
        OR
        (display_type <> 'product' AND product_id IS NULL)
    ),
    CONSTRAINT CK_Journal_Item_Tax CHECK (display_type = 'product' OR tax_id IS NULL),
    CONSTRAINT FK_Journal_Item_Entry
        FOREIGN KEY (entry_id) REFERENCES dbo.Journal_Entry(id) ON DELETE CASCADE,
    CONSTRAINT FK_Journal_Item_Account
        FOREIGN KEY (account_id) REFERENCES dbo.Account(id),
    CONSTRAINT FK_Journal_Item_Product
        FOREIGN KEY (product_id) REFERENCES dbo.Product(id),
    CONSTRAINT FK_Journal_Item_Tax
        FOREIGN KEY (tax_id) REFERENCES dbo.Tax(id),
    CONSTRAINT FK_Journal_Item_TaxLine
        FOREIGN KEY (tax_line_id) REFERENCES dbo.Tax(id)
);
GO

/* =====================================================================
   10. Phiếu thanh toán tiền mặt
   Một hóa đơn chỉ thanh toán đủ một lần.
   payment_for_invoice liên kết tới Journal_Entry của hóa đơn.
   ===================================================================== */
CREATE TABLE dbo.Payment (
    id                  INT IDENTITY(1,1) CONSTRAINT PK_Payment PRIMARY KEY,
    entry_id            INT NOT NULL CONSTRAINT UQ_Payment_Entry UNIQUE,
    payment_for_invoice INT NOT NULL CONSTRAINT UQ_Payment_Invoice UNIQUE,
    payment_type        VARCHAR(8) NOT NULL
                        CONSTRAINT CK_Payment_Type CHECK (payment_type IN ('inbound', 'outbound')),
    amount              DECIMAL(18,2) NOT NULL,
    payment_date        DATE NOT NULL CONSTRAINT DF_Payment_Date DEFAULT CAST(GETDATE() AS DATE),
    CONSTRAINT CK_Payment_Amount CHECK (amount > 0),
    CONSTRAINT FK_Payment_Entry
        FOREIGN KEY (entry_id) REFERENCES dbo.Journal_Entry(id)
);
GO

/* =====================================================================
   11. Indexes
   ===================================================================== */
CREATE INDEX IX_Product_CategoryId       ON dbo.Product(category_id);
CREATE INDEX IX_Journal_Entry_PartnerId  ON dbo.Journal_Entry(partner_id);
CREATE INDEX IX_Journal_Entry_StateType  ON dbo.Journal_Entry(state, entry_type);
CREATE INDEX IX_Journal_Item_EntryId     ON dbo.Journal_Item(entry_id);
CREATE INDEX IX_Journal_Item_ProductId   ON dbo.Journal_Item(product_id);
CREATE INDEX IX_Journal_Item_AccountId   ON dbo.Journal_Item(account_id);
GO

/* =====================================================================
   12. Dữ liệu cấu hình mẫu
   Tài khoản người dùng không được seed: Spring Boot sẽ tạo/nhập theo cơ chế
   bảo mật riêng, sử dụng BCrypt thay vì mật khẩu mã hóa cứng trong script.
   ===================================================================== */
INSERT INTO dbo.Partner (name, vat, email, phone, address, city, is_customer, is_supplier) VALUES
    (N'Công ty ABC', N'0312345678', 'ketoan@abc.vn', '0901234567', N'123 Nguyễn Văn Linh', N'TP. Hồ Chí Minh', 1, 0),
    (N'Công ty XYZ', N'0398765432', NULL, NULL, N'456 Lê Lợi', N'TP. Hồ Chí Minh', 0, 1);

INSERT INTO dbo.Account (code, name, account_type, reconcile) VALUES
    ('111',  N'Tiền mặt',                     'cash',       0),
    ('131',  N'Phải thu khách hàng',          'receivable', 1),
    ('331',  N'Phải trả nhà cung cấp',        'payable',    1),
    ('511',  N'Doanh thu bán hàng',           'income',     0),
    ('156',  N'Hàng hóa',                     'asset',      0),
    ('3331', N'Thuế GTGT phải nộp',           'liability',  0),
    ('1331', N'Thuế GTGT được khấu trừ',      'asset',      0);

INSERT INTO dbo.Journal (name, code, type, default_account_id) VALUES
    (N'Hóa đơn bán', 'INV',  'sale',     4),
    (N'Hóa đơn mua', 'BILL', 'purchase', 5),
    (N'Tiền mặt',    'CSH',  'cash',     1);

INSERT INTO dbo.Tax (name, amount, type_tax_use, account_id) VALUES
    (N'VAT bán 10%', 10, 'sale',     6),
    (N'VAT mua 10%', 10, 'purchase', 7);

INSERT INTO dbo.Product_Category (name, sales_account_id, purchase_account_id) VALUES
    (N'Phụ kiện máy tính', 4, 5);

INSERT INTO dbo.Product (code, name, category_id, uom, sale_price, cost_price, sale_tax_id, purchase_tax_id) VALUES
    ('BP-001', N'Bàn phím cơ',     1, N'Cái', 500000, 350000, 1, 2),
    ('CH-001', N'Chuột không dây', 1, N'Cái', 300000, 200000, 1, 2);
GO

/* Quick verification: each result must be 0 before the database is used. */
SELECT
    (SELECT COUNT(*) FROM dbo.Partner WHERE is_customer + is_supplier <> 1) AS invalid_partner_type_rows,
    (SELECT COUNT(*) FROM dbo.Journal WHERE code = 'CSH' AND type <> 'cash') AS invalid_cash_journal_rows,
    (SELECT COUNT(*) FROM dbo.Journal_Item WHERE debit > 0 AND credit > 0) AS invalid_journal_item_rows;
GO

