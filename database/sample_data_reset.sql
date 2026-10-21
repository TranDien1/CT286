/*
  THẬN TRỌNG: XÓA toàn bộ dữ liệu nghiệp vụ và danh mục trong CT286_Invoicing.
  Giữ nguyên App_User, Account, Journal. Chỉ chạy sau khi đã sao lưu database.
  Dữ liệu là minh họa; số chứng từ, đối tác và sản phẩm không có thật.
*/
USE CT286_Invoicing;
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @accountant int = (SELECT id FROM dbo.App_User WHERE user_name='ketoan' AND role='accountant' AND active=1);
    DECLARE @saleJournal int = (SELECT id FROM dbo.Journal WHERE code='INV' AND type='sale');
    DECLARE @buyJournal int = (SELECT id FROM dbo.Journal WHERE code='BILL' AND type='purchase');
    DECLARE @cashJournal int = (SELECT j.id FROM dbo.Journal j JOIN dbo.Account a ON a.id=j.default_account_id WHERE j.code='CSH' AND j.type='cash' AND a.code='111');
    DECLARE @cash int = (SELECT id FROM dbo.Account WHERE code='111');
    DECLARE @receivable int = (SELECT id FROM dbo.Account WHERE code='131' AND reconcile=1);
    DECLARE @payable int = (SELECT id FROM dbo.Account WHERE code='331' AND reconcile=1);
    DECLARE @sales int = (SELECT id FROM dbo.Account WHERE code='511');
    DECLARE @goods int = (SELECT id FROM dbo.Account WHERE code='156');
    DECLARE @saleVat int = (SELECT id FROM dbo.Account WHERE code='3331');
    DECLARE @buyVat int = (SELECT id FROM dbo.Account WHERE code='1331');
    IF @accountant IS NULL OR @saleJournal IS NULL OR @buyJournal IS NULL OR @cashJournal IS NULL
       OR @cash IS NULL OR @receivable IS NULL OR @payable IS NULL OR @sales IS NULL OR @goods IS NULL OR @saleVat IS NULL OR @buyVat IS NULL
       THROW 51000, N'Thiếu tài khoản kế toán hoặc cấu hình sổ cần thiết.', 1;
    IF (SELECT COUNT(*) FROM dbo.App_User WHERE (user_name='admin' AND role='admin') OR (user_name IN ('ketoan','ketoan2') AND role='accountant')) <> 3
       THROW 51001, N'Không tìm thấy đủ ba tài khoản mặc định.', 1;

    DELETE FROM dbo.Payment;
    DELETE FROM dbo.Journal_Item;
    DELETE FROM dbo.Journal_Entry;
    DELETE FROM dbo.Product;
    DELETE FROM dbo.Product_Category;
    DELETE FROM dbo.Tax;
    DELETE FROM dbo.Partner;

    DECLARE @partners TABLE (n int, kind varchar(8), id int);
    DECLARE @categories TABLE (n int, id int);
    DECLARE @products TABLE (n int, id int);
    DECLARE @taxes TABLE (n int, kind varchar(8), id int, rate decimal(8,4));
    DECLARE @i int = 1, @id int, @rate decimal(8,4), @today date = CAST(GETDATE() AS date);
    WHILE @i <= 10
    BEGIN
        INSERT dbo.Partner (name, address, city, is_customer, is_supplier) VALUES
          (N'Khách hàng mẫu ' + FORMAT(@i,'00'), N'Địa chỉ mẫu ' + CONVERT(nvarchar(10),@i), N'TP. Hồ Chí Minh',1,0);
        INSERT @partners VALUES (@i,'sale',SCOPE_IDENTITY());
        INSERT dbo.Partner (name, address, city, is_customer, is_supplier) VALUES
          (N'Nhà cung cấp mẫu ' + FORMAT(@i,'00'), N'Địa chỉ mẫu ' + CONVERT(nvarchar(10),@i), N'Hà Nội',0,1);
        INSERT @partners VALUES (@i,'purchase',SCOPE_IDENTITY());
        INSERT dbo.Product_Category (name,sales_account_id,purchase_account_id)
          VALUES (N'Nhóm sản phẩm mẫu ' + FORMAT(@i,'00'),@sales,@goods);
        INSERT @categories VALUES (@i,SCOPE_IDENTITY());
        SET @i += 1;
    END;
    SET @i = 1;
    WHILE @i <= 5
    BEGIN
        SET @rate = CASE @i WHEN 1 THEN 0 WHEN 2 THEN 5 WHEN 3 THEN 8 WHEN 4 THEN 10 ELSE 15 END;
        INSERT dbo.Tax (name,amount,type_tax_use,account_id) VALUES (N'Thuế GTGT phải nộp ' + FORMAT(@rate,'0.####','en-US') + N'%',@rate,'sale',@saleVat);
        INSERT @taxes VALUES (@i,'sale',SCOPE_IDENTITY(),@rate);
        INSERT dbo.Tax (name,amount,type_tax_use,account_id) VALUES (N'Thuế GTGT được khấu trừ ' + FORMAT(@rate,'0.####','en-US') + N'%',@rate,'purchase',@buyVat);
        INSERT @taxes VALUES (@i,'purchase',SCOPE_IDENTITY(),@rate);
        SET @i += 1;
    END;
    SET @i = 1;
    WHILE @i <= 10
    BEGIN
        INSERT dbo.Product (code,name,category_id,uom,sale_price,cost_price,sale_tax_id,purchase_tax_id)
        VALUES ('MAU-' + FORMAT(@i,'00'),N'Sản phẩm mẫu ' + FORMAT(@i,'00'),(SELECT id FROM @categories WHERE n=@i),N'Cái',@i*120000,@i*80000,
                (SELECT id FROM @taxes WHERE n=((@i-1)%5)+1 AND kind='sale'),(SELECT id FROM @taxes WHERE n=((@i-1)%5)+1 AND kind='purchase'));
        INSERT @products VALUES (@i,SCOPE_IDENTITY());
        SET @i += 1;
    END;

    DECLARE @kind int = 0, @invoice int, @paymentEntry int, @partner int, @product int, @tax int, @account int, @taxAccount int, @debt int;
    DECLARE @invoiceDate date, @due date, @paymentDate date, @untaxed decimal(18,2), @taxAmount decimal(18,2), @total decimal(18,2);
    DECLARE @invoiceName varchar(64), @paymentName varchar(64), @state varchar(16), @type varchar(16), @journal int, @paymentType varchar(8);
    WHILE @kind < 2
    BEGIN
        SET @i = 1;
        WHILE @i <= 10
        BEGIN
            SET @type = CASE WHEN @kind=0 THEN 'out_invoice' ELSE 'in_invoice' END;
            SET @journal = CASE WHEN @kind=0 THEN @saleJournal ELSE @buyJournal END;
            SET @account = CASE WHEN @kind=0 THEN @sales ELSE @goods END;
            SET @taxAccount = CASE WHEN @kind=0 THEN @saleVat ELSE @buyVat END;
            SET @debt = CASE WHEN @kind=0 THEN @receivable ELSE @payable END;
            SELECT @partner=id FROM @partners WHERE n=@i AND kind=CASE WHEN @kind=0 THEN 'sale' ELSE 'purchase' END;
            SELECT @product=id FROM @products WHERE n=@i;
            SELECT @tax=id,@rate=rate FROM @taxes WHERE n=((@i-1)%5)+1 AND kind=CASE WHEN @kind=0 THEN 'sale' ELSE 'purchase' END;
            SET @invoiceDate=DATEADD(month,-@i,@today);
            SET @due=CASE WHEN @i=3 THEN DATEADD(day,15,@today) ELSE DATEADD(day,30,@invoiceDate) END;
            SET @paymentDate=DATEADD(day,5,@invoiceDate);
            SET @state=CASE WHEN @i<=2 THEN 'draft' ELSE 'posted' END;
            SET @invoiceName=CASE WHEN @state='draft' THEN NULL ELSE (CASE WHEN @kind=0 THEN 'INV/' ELSE 'BILL/' END) + CONVERT(varchar(4),YEAR(@invoiceDate)) + '/' + FORMAT(@i,'0000') END;
            SET @untaxed=@i*(CASE WHEN @kind=0 THEN 120000 ELSE 80000 END)*(@i%3+1);
            SET @taxAmount=ROUND(@untaxed*@rate/100,0);
            SET @total=@untaxed+@taxAmount;
            INSERT dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,invoice_date,invoice_date_due,[date],amount_untaxed,amount_tax,amount_total,payment_state,notes)
            VALUES (@invoiceName,@type,@state,@journal,@partner,@accountant,@invoiceDate,@due,@invoiceDate,@untaxed,@taxAmount,@total,CASE WHEN @i>=6 THEN 'paid' ELSE 'not_paid' END,N'Dữ liệu mẫu để kiểm thử');
            SET @invoice=SCOPE_IDENTITY();
            INSERT dbo.Journal_Item (entry_id,account_id,product_id,tax_id,name,display_type,quantity,price_unit,debit,credit)
            VALUES (@invoice,@account,@product,@tax,N'Sản phẩm mẫu '+FORMAT(@i,'00'),'product',@i%3+1,@i*(CASE WHEN @kind=0 THEN 120000 ELSE 80000 END),CASE WHEN @kind=1 THEN @untaxed ELSE 0 END,CASE WHEN @kind=0 THEN @untaxed ELSE 0 END);
            IF @taxAmount>0
              INSERT dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,tax_line_id)
              VALUES (@invoice,@taxAccount,N'Thuế GTGT mẫu','tax',CASE WHEN @kind=1 THEN @taxAmount ELSE 0 END,CASE WHEN @kind=0 THEN @taxAmount ELSE 0 END,@tax);
            INSERT dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,reconciled)
            VALUES (@invoice,@debt,CASE WHEN @kind=0 THEN N'Phải thu khách hàng' ELSE N'Phải trả nhà cung cấp' END,'payment_term',CASE WHEN @kind=0 THEN @total ELSE 0 END,CASE WHEN @kind=1 THEN @total ELSE 0 END,CASE WHEN @i>=6 THEN 1 ELSE 0 END);
            IF @i>=6
            BEGIN
                SET @paymentType=CASE WHEN @kind=0 THEN 'inbound' ELSE 'outbound' END;
                SET @paymentName='CSH/' + CONVERT(varchar(4),YEAR(@paymentDate)) + '/' + FORMAT(@i+@kind*10,'0000');
                INSERT dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,[date]) VALUES (@paymentName,'entry','posted',@cashJournal,@partner,@accountant,@paymentDate);
                SET @paymentEntry=SCOPE_IDENTITY();
                INSERT dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,reconciled) VALUES
                  (@paymentEntry,@cash,CASE WHEN @kind=0 THEN N'Thu tiền' ELSE N'Chi tiền' END,'cash',CASE WHEN @kind=0 THEN @total ELSE 0 END,CASE WHEN @kind=1 THEN @total ELSE 0 END,0),
                  (@paymentEntry,@debt,N'Tất toán hóa đơn','payment_term',CASE WHEN @kind=1 THEN @total ELSE 0 END,CASE WHEN @kind=0 THEN @total ELSE 0 END,1);
                INSERT dbo.Payment (entry_id,payment_for_invoice,payment_type,amount,payment_date) VALUES (@paymentEntry,@invoice,@paymentType,@total,@paymentDate);
            END;
            SET @i += 1;
        END;
        SET @kind += 1;
    END;
    IF EXISTS (SELECT entry_id FROM dbo.Journal_Item GROUP BY entry_id HAVING SUM(debit)<>SUM(credit)) THROW 51002, N'Bút toán không cân bằng.', 1;
    IF (SELECT COUNT(*) FROM dbo.Payment)<>10 OR (SELECT COUNT(*) FROM dbo.Journal_Entry WHERE entry_type IN ('out_invoice','in_invoice'))<>20 THROW 51003, N'Số lượng chứng từ mẫu không khớp.', 1;
    COMMIT TRANSACTION;
    SELECT 'Partner' AS [table],COUNT(*) AS [rows] FROM dbo.Partner UNION ALL SELECT 'Tax',COUNT(*) FROM dbo.Tax UNION ALL SELECT 'Product_Category',COUNT(*) FROM dbo.Product_Category UNION ALL SELECT 'Product',COUNT(*) FROM dbo.Product UNION ALL SELECT 'Invoice',COUNT(*) FROM dbo.Journal_Entry WHERE entry_type IN ('out_invoice','in_invoice') UNION ALL SELECT 'Payment',COUNT(*) FROM dbo.Payment UNION ALL SELECT 'Journal_Entry',COUNT(*) FROM dbo.Journal_Entry UNION ALL SELECT 'Journal_Item',COUNT(*) FROM dbo.Journal_Item;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
