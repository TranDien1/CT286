/*
  CT286 - Cho phép một Partner vừa là khách hàng vừa là nhà cung cấp.
  Chạy trong database CT286_Invoicing hiện có. Không thêm cột, không sửa dữ liệu.
  Có thể chạy lại: nếu đã áp dụng, script chỉ kiểm tra ràng buộc.
*/

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.Partner', N'U') IS NULL
        THROW 51000, N'Không tìm thấy bảng dbo.Partner trong database hiện tại.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Partner WHERE is_customer = 0 AND is_supplier = 0)
        THROW 51001, N'Có đối tác chưa mang vai trò khách hàng hoặc nhà cung cấp.', 1;

    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE parent_object_id = OBJECT_ID(N'dbo.Partner') AND name = N'CK_Partner_ExactlyOneType')
        ALTER TABLE dbo.Partner DROP CONSTRAINT CK_Partner_ExactlyOneType;

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.Partner') AND name = N'CK_Partner_AtLeastOneType')
        ALTER TABLE dbo.Partner WITH CHECK
        ADD CONSTRAINT CK_Partner_AtLeastOneType CHECK (is_customer = 1 OR is_supplier = 1);

    ALTER TABLE dbo.Partner WITH CHECK CHECK CONSTRAINT CK_Partner_AtLeastOneType;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT DB_NAME() AS database_name, name, is_disabled, is_not_trusted
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.Partner') AND name = N'CK_Partner_AtLeastOneType';
