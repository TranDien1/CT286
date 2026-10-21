/*
  CT286 - migration from invoicing_schema_sqlserver_v5.sql

  Purpose
  -------
  1. Persist Partner address and city for the existing Partner form/invoice preview.
  2. Enforce the approved UI rule: a partner is exactly one type
     (customer XOR supplier).
  3. Persist invoice notes on Journal_Entry.

  This script is deliberately idempotent where possible. Run it once against a
  database created from invoicing_schema_sqlserver_v5.sql. It is not a seed script.
*/

SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;
GO

/* Partner fields shown in the UI. VAT already exists; do not add another MST column. */
IF COL_LENGTH(N'dbo.Partner', N'address') IS NULL
    ALTER TABLE dbo.Partner ADD address NVARCHAR(255) NULL;
GO

IF COL_LENGTH(N'dbo.Partner', N'city') IS NULL
    ALTER TABLE dbo.Partner ADD city NVARCHAR(128) NULL;
GO

/*
  The UI has one dropdown for partner type. Existing rows must therefore have
  exactly one flag set before the constraint can be created.
*/
IF EXISTS (
    SELECT 1
    FROM dbo.Partner
    WHERE (is_customer = 1 AND is_supplier = 1)
       OR (is_customer = 0 AND is_supplier = 0)
)
    THROW 51000, N'Không thể áp dụng quy tắc một loại Partner: có dữ liệu không có loại hoặc có cả hai loại.', 1;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.Partner')
      AND name = N'CK_Partner_ExactlyOneType'
)
    ALTER TABLE dbo.Partner WITH CHECK
    ADD CONSTRAINT CK_Partner_ExactlyOneType
    CHECK (
        (is_customer = 1 AND is_supplier = 0)
        OR
        (is_customer = 0 AND is_supplier = 1)
    );
GO

IF COL_LENGTH(N'dbo.Journal_Entry', N'notes') IS NULL
    ALTER TABLE dbo.Journal_Entry ADD notes NVARCHAR(1000) NULL;
GO

COMMIT TRANSACTION;
GO

