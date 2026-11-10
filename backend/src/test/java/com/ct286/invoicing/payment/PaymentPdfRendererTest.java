package com.ct286.invoicing.payment;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PaymentPdfRendererTest {
    private final PaymentPdfRenderer renderer = new PaymentPdfRenderer("CT286 Invoicing");

    @Test void rendersReceiptAndDisbursementWithoutFakeSignatures() throws IOException {
        for (String type : List.of("inbound","outbound")) {
            PaymentDetailDto detail = PaymentPdfServiceTest.detail(type,"posted",
                    new java.math.BigDecimal("1000000"));
            byte[] bytes = renderer.render(detail);
            assertEquals("%PDF",new String(bytes,0,4,StandardCharsets.US_ASCII));
            try (var document = Loader.loadPDF(bytes)) {
                assertEquals(1,document.getNumberOfPages());
                String text = new PDFTextStripper().getText(document);
                assertTrue(text.contains(type.equals("inbound") ? "PHIẾU THU" : "PHIẾU CHI"));
                assertTrue(text.contains("CSH/2026/0007"));
                assertTrue(text.contains("CT286 Invoicing"));
                assertTrue(text.contains("0312345678"));
                assertTrue(text.contains("123 Nguyễn Huệ, TP. Hồ Chí Minh"));
                assertTrue(text.contains("Thanh toán đủ hóa đơn"));
                assertTrue(text.contains("Một triệu đồng"));
                assertTrue(text.contains("Tiền mặt"));
                assertTrue(text.contains(type.equals("inbound") ? "131" : "331"));
                assertFalse(text.contains("Thủ quỹ"));
                assertFalse(text.contains("Người duyệt"));
            }
            String previewDir = System.getProperty("pdf.payment.preview.dir");
            if (previewDir != null && !previewDir.isBlank()) {
                Path dir = Path.of(previewDir);
                Files.createDirectories(dir);
                Files.write(dir.resolve(type.equals("inbound") ? "receipt-preview.pdf" : "disbursement-preview.pdf"),bytes);
            }
        }
    }

    @Test void keepsLongValidTextAndAccountingLinesOnPages() throws IOException {
        PaymentDetailDto base = PaymentPdfServiceTest.detail("outbound","posted",
                new java.math.BigDecimal("1000000"));
        String longName = ("Công ty TNHH Công nghệ Thành Công ").repeat(8).substring(0,255);
        String longAddress = ("123 Đường Nguyễn Huệ, Thành phố Hồ Chí Minh ").repeat(7).substring(0,255)
                + ", " + ("Thành phố Hồ Chí Minh ").repeat(6).substring(0,128);
        String accountName = ("Hàng hóa và công nợ với nhà cung cấp ").repeat(8).substring(0,255);
        List<PaymentDetailDto.Item> items = base.items().stream().map(item ->
                new PaymentDetailDto.Item(item.id(),item.accountCode(),accountName,item.label(),
                        item.displayType(),item.debit(),item.credit(),item.reconciled())).toList();
        PaymentDetailDto detail = new PaymentDetailDto(base.id(),base.entryId(),base.invoiceId(),base.name(),
                base.paymentType(),base.amount(),base.paymentDate(),base.journal(),
                new PaymentDto.Reference(6,longName,null),new PaymentDto.Reference(2,longName,null),
                base.invoiceName(),base.invoiceType(),base.createdAt(),base.state(),base.reason(),
                base.amountWords(),base.partnerVat(),longAddress,base.reconciled(),items);
        byte[] bytes = renderer.render(detail);
        try (var document = Loader.loadPDF(bytes)) {
            assertTrue(document.getNumberOfPages() >= 2);
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("Tổng"));
            assertTrue(text.contains("Trang 2 / " + document.getNumberOfPages()));
            assertTrue(text.contains("Phải") || text.contains("Hàng hóa"));
        }
        String previewDir = System.getProperty("pdf.payment.preview.dir");
        if (previewDir != null && !previewDir.isBlank()) {
            Path dir = Path.of(previewDir);
            Files.createDirectories(dir);
            Files.write(dir.resolve("long-voucher-preview.pdf"),bytes);
        }
    }
}
