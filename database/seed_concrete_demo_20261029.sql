/*
  CT286: thay dữ liệu minh họa bằng dữ liệu cụ thể nhưng hoàn toàn giả định.
  XÓA Partner, Product, Product_Category, Journal_Entry, Journal_Item, Payment.
  GIỮ NGUYÊN App_User, Account, Journal và toàn bộ Tax.
  Chạy trên CT286_Invoicing sau khi đã backup. Một transaction; lỗi sẽ rollback.
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
  DECLARE @taxBefore int = (SELECT COUNT(*) FROM dbo.Tax);
  DECLARE @actor int = (SELECT id FROM dbo.App_User WHERE user_name='ketoan' AND role='accountant' AND active=1);
  DECLARE @adminCount int = (SELECT COUNT(*) FROM dbo.App_User WHERE (user_name='admin' AND role='admin') OR (user_name IN ('ketoan','ketoan2') AND role='accountant'));
  DECLARE @inv int = (SELECT id FROM dbo.Journal WHERE code='INV' AND type='sale');
  DECLARE @bill int = (SELECT id FROM dbo.Journal WHERE code='BILL' AND type='purchase');
  DECLARE @csh int = (SELECT j.id FROM dbo.Journal j JOIN dbo.Account a ON a.id=j.default_account_id WHERE j.code='CSH' AND j.type='cash' AND a.code='111');
  DECLARE @cash int = (SELECT id FROM dbo.Account WHERE code='111');
  DECLARE @recv int = (SELECT id FROM dbo.Account WHERE code='131' AND reconcile=1);
  DECLARE @payable int = (SELECT id FROM dbo.Account WHERE code='331' AND reconcile=1);
  DECLARE @sales int = (SELECT id FROM dbo.Account WHERE code='511');
  DECLARE @goods int = (SELECT id FROM dbo.Account WHERE code='156');
  DECLARE @vatOut int = (SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='sale' AND amount=10 AND account_id=(SELECT id FROM dbo.Account WHERE code='3331') ORDER BY id);
  DECLARE @vatIn int = (SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='purchase' AND amount=10 AND account_id=(SELECT id FROM dbo.Account WHERE code='1331') ORDER BY id);
  IF @adminCount<>3 OR @actor IS NULL OR @inv IS NULL OR @bill IS NULL OR @csh IS NULL OR @cash IS NULL OR @recv IS NULL OR @payable IS NULL OR @sales IS NULL OR @goods IS NULL OR @vatOut IS NULL OR @vatIn IS NULL
    THROW 51000, N'Thiếu tài khoản người dùng, sổ, tài khoản kế toán hoặc thuế GTGT 10% cần thiết.', 1;

  DELETE FROM dbo.Payment;
  DELETE FROM dbo.Journal_Item;
  DELETE FROM dbo.Journal_Entry;
  DELETE FROM dbo.Product;
  DELETE FROM dbo.Product_Category;
  DELETE FROM dbo.Partner;

  DECLARE @partners TABLE (n int, kind varchar(8), id int);
  DECLARE @categories TABLE (n int, id int);
  DECLARE @products TABLE (n int, id int, sale_price decimal(18,2), cost_price decimal(18,2), name nvarchar(255));
  DECLARE @partyData TABLE (n int, kind varchar(8), name nvarchar(255), vat varchar(32), email varchar(255), phone varchar(32), address nvarchar(255), city nvarchar(128));
  INSERT @partyData VALUES
    (1,'sale',N'Công ty TNHH Công nghệ Thành Công','0300000001','ketoan@thanhcong.example','0900000001',N'125 Nguyễn Văn Linh',N'TP. Hồ Chí Minh'),
    (2,'sale',N'Công ty Cổ phần Giải pháp Sao Việt','0300000002','ketoan@saoviet.example','0900000002',N'48 Cộng Hòa',N'TP. Hồ Chí Minh'),
    (3,'sale',N'Công ty TNHH Thương mại Minh Phát','0100000003','ketoan@minhphat.example','0900000003',N'18 Lê Văn Lương',N'Hà Nội'),
    (4,'sale',N'Công ty Cổ phần Giáo dục Hướng Dương','0400000004','ketoan@huongduong.example','0900000004',N'72 Nguyễn Văn Linh',N'Đà Nẵng'),
    (5,'sale',N'Công ty TNHH Dịch vụ An Bình','0310000005','ketoan@anbinh.example','0900000005',N'206 Điện Biên Phủ',N'TP. Hồ Chí Minh'),
    (6,'sale',N'Công ty Cổ phần Nội thất Đại Phát','0100000006','ketoan@daiphat.example','0900000006',N'30 Trần Duy Hưng',N'Hà Nội'),
    (1,'purchase',N'Công ty TNHH Phân phối Thiết bị Bắc Nam','0100000011','ketoan@bacnam.example','0910000011',N'15 Phạm Hùng',N'Hà Nội'),
    (2,'purchase',N'Công ty Cổ phần Linh kiện Á Châu','0300000012','ketoan@achau.example','0910000012',N'88 Xa lộ Hà Nội',N'TP. Hồ Chí Minh'),
    (3,'purchase',N'Công ty TNHH Máy tính Hải Đăng','0400000013','ketoan@haidang.example','0910000013',N'12 Nguyễn Tri Phương',N'Đà Nẵng'),
    (4,'purchase',N'Công ty TNHH Kho vận Phú Mỹ','3500000014','ketoan@phumy.example','0910000014',N'55 Quốc lộ 51',N'Bà Rịa - Vũng Tàu'),
    (5,'purchase',N'Công ty Cổ phần Công nghệ Tân Á','0100000015','ketoan@tana.example','0910000015',N'41 Duy Tân',N'Hà Nội'),
    (6,'purchase',N'Công ty TNHH Thiết bị Văn phòng Bình Minh','0300000016','ketoan@binhminh.example','0910000016',N'90 Lý Thường Kiệt',N'TP. Hồ Chí Minh');
  DECLARE @i int=1, @id int;
  WHILE @i<=6 BEGIN
    INSERT dbo.Partner (name,vat,email,phone,address,city,is_customer,is_supplier)
      SELECT name,vat,email,phone,address,city,1,0 FROM @partyData WHERE n=@i AND kind='sale';
    INSERT @partners VALUES (@i,'sale',SCOPE_IDENTITY());
    INSERT dbo.Partner (name,vat,email,phone,address,city,is_customer,is_supplier)
      SELECT name,vat,email,phone,address,city,0,1 FROM @partyData WHERE n=@i AND kind='purchase';
    INSERT @partners VALUES (@i,'purchase',SCOPE_IDENTITY());
    SET @i+=1;
  END;

  DECLARE @productData TABLE (n int, category nvarchar(128), code varchar(32), name nvarchar(255), uom nvarchar(32), sale_price decimal(18,2), cost_price decimal(18,2));
  INSERT @productData VALUES
    (1,N'Máy tính xách tay','LAP-001',N'Máy tính xách tay 14 inch',N'Cái',14500000,11200000),
    (2,N'Thiết bị mạng','NET-001',N'Bộ định tuyến Wi-Fi 6',N'Cái',1850000,1320000),
    (3,N'Thiết bị lưu trữ','SSD-001',N'Ổ cứng SSD 1TB',N'Cái',2150000,1580000),
    (4,N'Thiết bị hiển thị','MON-001',N'Màn hình 24 inch Full HD',N'Cái',3650000,2790000),
    (5,N'Phụ kiện máy tính','KEY-001',N'Bàn phím cơ văn phòng',N'Cái',950000,640000),
    (6,N'Thiết bị văn phòng','PRN-001',N'Máy in laser A4',N'Cái',4250000,3180000);
  SET @i=1;
  WHILE @i<=6 BEGIN
    INSERT dbo.Product_Category (name,sales_account_id,purchase_account_id)
      SELECT category,@sales,@goods FROM @productData WHERE n=@i;
    INSERT @categories VALUES (@i,SCOPE_IDENTITY());
    INSERT dbo.Product (code,name,category_id,uom,sale_price,cost_price,sale_tax_id,purchase_tax_id)
      SELECT code,name,(SELECT id FROM @categories WHERE n=@i),uom,sale_price,cost_price,@vatOut,@vatIn FROM @productData WHERE n=@i;
    INSERT @products SELECT @i,SCOPE_IDENTITY(),sale_price,cost_price,name FROM @productData WHERE n=@i;
    SET @i+=1;
  END;

  DECLARE @kind int=0, @entry int, @paymentEntry int, @partner int, @product int, @nextProduct int, @tax int, @itemAccount int, @taxAccount int, @debt int;
  DECLARE @unit decimal(18,2), @unit2 decimal(18,2), @subtotal decimal(18,2), @subtotal2 decimal(18,2), @base decimal(18,2), @taxAmount decimal(18,2), @total decimal(18,2), @qty decimal(12,3), @qty2 decimal(12,3);
  DECLARE @name1 nvarchar(255), @name2 nvarchar(255), @day date, @due date, @paidOn date, @state varchar(16), @entryName varchar(64), @paymentName varchar(64), @entryType varchar(16), @paymentType varchar(8);
  WHILE @kind<2 BEGIN
    SET @i=1;
    WHILE @i<=6 BEGIN
      SET @entryType=CASE WHEN @kind=0 THEN 'out_invoice' ELSE 'in_invoice' END;
      SET @paymentType=CASE WHEN @kind=0 THEN 'inbound' ELSE 'outbound' END;
      SET @tax=CASE WHEN @kind=0 THEN @vatOut ELSE @vatIn END;
      SET @itemAccount=CASE WHEN @kind=0 THEN @sales ELSE @goods END;
      SET @taxAccount=(SELECT account_id FROM dbo.Tax WHERE id=@tax);
      SET @debt=CASE WHEN @kind=0 THEN @recv ELSE @payable END;
      SET @day=DATEADD(month,-@i,CAST(GETDATE() AS date));
      SET @due=CASE WHEN @i=2 THEN DATEADD(day,30,CAST(GETDATE() AS date)) ELSE DATEADD(day,30,@day) END;
      SET @paidOn=DATEADD(day,5,@day);
      SET @state=CASE WHEN @i=1 THEN 'draft' ELSE 'posted' END;
      SET @entryName=CASE WHEN @state='draft' THEN NULL ELSE (CASE WHEN @kind=0 THEN 'INV/' ELSE 'BILL/' END)+CONVERT(varchar(4),YEAR(@day))+'/'+RIGHT('0000'+CONVERT(varchar(4),@i),4) END;
      SELECT @partner=id FROM @partners WHERE n=@i AND kind=CASE WHEN @kind=0 THEN 'sale' ELSE 'purchase' END;
      SELECT @product=id,@unit=CASE WHEN @kind=0 THEN sale_price ELSE cost_price END,@name1=name FROM @products WHERE n=@i;
      SELECT @nextProduct=id,@unit2=CASE WHEN @kind=0 THEN sale_price ELSE cost_price END,@name2=name FROM @products WHERE n=(@i%6)+1;
      SET @qty=CONVERT(decimal(12,3),@i+1); SET @qty2=CONVERT(decimal(12,3),@i);
      SET @subtotal=ROUND(@qty*@unit,0); SET @subtotal2=ROUND(@qty2*@unit2,0);
      SET @base=@subtotal+@subtotal2;
      SET @taxAmount=ROUND(@subtotal*0.10,0)+ROUND(@subtotal2*0.10,0);
      SET @total=@base+@taxAmount;
      INSERT dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,invoice_date,invoice_date_due,[date],amount_untaxed,amount_tax,amount_total,payment_state,notes)
      VALUES (@entryName,@entryType,@state,CASE WHEN @kind=0 THEN @inv ELSE @bill END,@partner,@actor,@day,@due,@day,@base,@taxAmount,@total,CASE WHEN @i>=4 THEN 'paid' ELSE 'not_paid' END,
              CASE WHEN @kind=0 THEN N'Bán thiết bị công nghệ theo đơn đặt hàng của khách.' ELSE N'Mua thiết bị bổ sung cho kho hàng.' END);
      SET @entry=SCOPE_IDENTITY();
      INSERT dbo.Journal_Item (entry_id,account_id,product_id,tax_id,name,display_type,quantity,price_unit,debit,credit) VALUES
        (@entry,@itemAccount,@product,@tax,@name1,'product',@qty,@unit,CASE WHEN @kind=1 THEN @subtotal ELSE 0 END,CASE WHEN @kind=0 THEN @subtotal ELSE 0 END),
        (@entry,@itemAccount,@nextProduct,@tax,@name2,'product',@qty2,@unit2,CASE WHEN @kind=1 THEN @subtotal2 ELSE 0 END,CASE WHEN @kind=0 THEN @subtotal2 ELSE 0 END);
      INSERT dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,tax_line_id)
        VALUES (@entry,@taxAccount,N'Thuế GTGT 10%','tax',CASE WHEN @kind=1 THEN @taxAmount ELSE 0 END,CASE WHEN @kind=0 THEN @taxAmount ELSE 0 END,@tax);
      INSERT dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,reconciled)
        VALUES (@entry,@debt,CASE WHEN @kind=0 THEN N'Phải thu khách hàng' ELSE N'Phải trả nhà cung cấp' END,'payment_term',CASE WHEN @kind=0 THEN @total ELSE 0 END,CASE WHEN @kind=1 THEN @total ELSE 0 END,CASE WHEN @i>=4 THEN 1 ELSE 0 END);
      IF @i>=4 BEGIN
        SET @paymentName='CSH/'+CONVERT(varchar(4),YEAR(@paidOn))+'/'+RIGHT('0000'+CONVERT(varchar(4),@i+@kind*6),4);
        INSERT dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,[date]) VALUES (@paymentName,'entry','posted',@csh,@partner,@actor,@paidOn);
        SET @paymentEntry=SCOPE_IDENTITY();
        INSERT dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,reconciled) VALUES
          (@paymentEntry,@cash,CASE WHEN @kind=0 THEN N'Thu tiền ' ELSE N'Chi tiền ' END+@entryName,'cash',CASE WHEN @kind=0 THEN @total ELSE 0 END,CASE WHEN @kind=1 THEN @total ELSE 0 END,0),
          (@paymentEntry,@debt,N'Tất toán '+@entryName,'payment_term',CASE WHEN @kind=1 THEN @total ELSE 0 END,CASE WHEN @kind=0 THEN @total ELSE 0 END,1);
        INSERT dbo.Payment (entry_id,payment_for_invoice,payment_type,amount,payment_date) VALUES (@paymentEntry,@entry,@paymentType,@total,@paidOn);
      END;
      SET @i+=1;
    END;
    SET @kind+=1;
  END;
  IF (SELECT COUNT(*) FROM dbo.Tax)<>@taxBefore OR (SELECT COUNT(*) FROM dbo.Partner)<>12 OR (SELECT COUNT(*) FROM dbo.Product)<>6 OR (SELECT COUNT(*) FROM dbo.Journal_Entry WHERE entry_type='out_invoice')<>6 OR (SELECT COUNT(*) FROM dbo.Journal_Entry WHERE entry_type='in_invoice')<>6 OR (SELECT COUNT(*) FROM dbo.Payment)<>6
    THROW 51001,N'Số dòng dữ liệu mẫu không khớp.',1;
  IF EXISTS (SELECT entry_id FROM dbo.Journal_Item GROUP BY entry_id HAVING SUM(debit)<>SUM(credit)) THROW 51002,N'Có bút toán không cân.',1;
  COMMIT TRANSACTION;
  SELECT 'Partner' AS table_name,COUNT(*) AS row_count FROM dbo.Partner UNION ALL SELECT 'Product',COUNT(*) FROM dbo.Product UNION ALL SELECT 'Tax',COUNT(*) FROM dbo.Tax UNION ALL SELECT 'Sales invoice',COUNT(*) FROM dbo.Journal_Entry WHERE entry_type='out_invoice' UNION ALL SELECT 'Purchase invoice',COUNT(*) FROM dbo.Journal_Entry WHERE entry_type='in_invoice' UNION ALL SELECT 'Payment',COUNT(*) FROM dbo.Payment;
END TRY
BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
