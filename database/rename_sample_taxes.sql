/* Chỉ đổi tên các thuế mẫu được tạo bởi sample_data_reset.sql. */
USE CT286_Invoicing;
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;
UPDATE t
SET name = CASE t.type_tax_use
    WHEN 'sale' THEN N'Thuế GTGT phải nộp '
    ELSE N'Thuế GTGT được khấu trừ ' END + FORMAT(t.amount,'0.####','en-US') + N'%'
FROM dbo.Tax t
JOIN dbo.Account a ON a.id=t.account_id
WHERE (t.type_tax_use='sale' AND a.code='3331' AND t.name IN (N'Thuế bán mẫu 1',N'Thuế bán mẫu 2',N'Thuế bán mẫu 3',N'Thuế bán mẫu 4',N'Thuế bán mẫu 5'))
   OR (t.type_tax_use='purchase' AND a.code='1331' AND t.name IN (N'Thuế mua mẫu 1',N'Thuế mua mẫu 2',N'Thuế mua mẫu 3',N'Thuế mua mẫu 4',N'Thuế mua mẫu 5'));
SELECT @@ROWCOUNT AS updated_count;
COMMIT TRANSACTION;
