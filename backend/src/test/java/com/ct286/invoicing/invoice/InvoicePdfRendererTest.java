package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class InvoicePdfRendererTest {
    private final InvoicePdfRenderer renderer = new InvoicePdfRenderer();

    @Test void rendersVietnameseAndThreeDigitQuantity() throws IOException {
        InvoicePdfData data = sample(List.of(new InvoicePdfData.Line("Máy in màu văn phòng",
                        new BigDecimal("1.001"), new BigDecimal("100000"),
                        new BigDecimal("7.1250"), new BigDecimal("100100"))),
                List.of(new InvoicePdfData.TaxTotal("Thuế GTGT phải nộp 7,125%", new BigDecimal("7132"))),
                new BigDecimal("100100"), new BigDecimal("7132"), new BigDecimal("107232"));
        byte[] bytes = renderer.render(data);
        assertEquals("%PDF", new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII));
        try (PDDocument document = Loader.loadPDF(bytes)) {
            assertEquals(1, document.getNumberOfPages());
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("HÓA ĐƠN BÁN HÀNG"));
            assertTrue(text.contains("Công ty TNHH Công nghệ Thành Công"));
            assertTrue(text.contains("1,001"));
            assertTrue(text.contains("7,125%"));
            assertTrue(text.contains("Nội dung thanh toán: INV/2026/0007"));
            assertTrue(text.contains("Một trăm lẻ bảy nghìn hai trăm ba mươi hai đồng"));
        }
        String preview = System.getProperty("pdf.preview");
        if (preview != null && !preview.isBlank()) {
            Path target = Path.of(preview);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        }
    }

    @Test void flowsLongItemsAndTaxNamesAcrossPages() throws IOException {
        List<InvoicePdfData.Line> lines = new ArrayList<>();
        for (int i = 0; i < 65; i++)
            lines.add(new InvoicePdfData.Line("Thiết bị văn phòng cao cấp số " + (i + 1)
                    + " dành cho doanh nghiệp tại Thành phố Hồ Chí Minh", BigDecimal.ONE,
                    new BigDecimal("100000"), BigDecimal.TEN, new BigDecimal("100000")));
        List<InvoicePdfData.TaxTotal> taxes = new ArrayList<>();
        for (int i = 0; i < 9; i++)
            taxes.add(new InvoicePdfData.TaxTotal("Thuế giá trị gia tăng phải nộp cho nhóm hàng văn phòng " + (i + 1),
                    new BigDecimal("10000")));
        InvoicePdfData data = sample(lines, taxes, new BigDecimal("6500000"), new BigDecimal("90000"),
                new BigDecimal("6590000"));
        byte[] bytes = renderer.render(data);
        try (PDDocument document = Loader.loadPDF(bytes)) {
            assertTrue(document.getNumberOfPages() >= 4);
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("Thiết bị văn phòng cao cấp số 1"));
            assertTrue(text.contains("Thiết bị văn phòng cao cấp số 65"));
            assertTrue(text.contains("Thuế giá trị gia tăng"));
            assertTrue(text.contains("văn phòng 9"));
            assertTrue(text.contains("Tổng thanh toán"));
            assertTrue(text.contains("Trang " + document.getNumberOfPages() + " / " + document.getNumberOfPages()));
        }
        String preview = System.getProperty("pdf.preview.multi");
        if (preview != null && !preview.isBlank()) {
            Path target = Path.of(preview);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        }
    }

    @Test void rendersPurchaseWithSupplierAsSeller() throws IOException {
        InvoicePdfData data = new InvoicePdfData("BILL/2026/0008", "HÓA ĐƠN MUA HÀNG",
                LocalDate.of(2026, 10, 29), LocalDate.of(2026, 11, 29),
                "Công ty TNHH Công nghệ Thành Công - Chi nhánh phía Nam", "0312345678",
                "123 Đường Nguyễn Huệ, Phường Bến Nghé, Thành phố Hồ Chí Minh",
                "CT286 Invoicing", "", "", "paid", "Nhập hàng tại kho",
                List.of(new InvoicePdfData.Line("Máy in màu văn phòng", new BigDecimal("1.001"),
                        new BigDecimal("100000"), new BigDecimal("7.1250"), new BigDecimal("100100"))),
                List.of(new InvoicePdfData.TaxTotal("Thuế GTGT được khấu trừ 7,125%", new BigDecimal("7132"))),
                new BigDecimal("100100"), new BigDecimal("7132"), new BigDecimal("107232"));
        byte[] bytes = renderer.render(data);
        try (PDDocument document = Loader.loadPDF(bytes)) {
            assertEquals(1, document.getNumberOfPages());
            assertTrue(document.getDocumentInformation().getTitle().contains("HÓA ĐƠN MUA HÀNG"));
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("HÓA ĐƠN MUA HÀNG"));
            assertTrue(text.contains("Công ty TNHH Công nghệ Thành Công"));
            assertTrue(text.contains("CT286 Invoicing"));
            assertTrue(text.contains("1,001"));
            assertTrue(text.contains("7,125%"));
            assertTrue(text.contains("107.232 đ"));
            assertTrue(text.contains("Nội dung thanh toán: BILL/2026/0008"));
        }
        String preview = System.getProperty("pdf.preview.purchase");
        if (preview != null && !preview.isBlank()) {
            Path target = Path.of(preview);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        }
    }

    private InvoicePdfData sample(List<InvoicePdfData.Line> lines, List<InvoicePdfData.TaxTotal> taxes,
                                  BigDecimal untaxed, BigDecimal tax, BigDecimal total) {
        return new InvoicePdfData("INV/2026/0007", "HÓA ĐƠN BÁN HÀNG",
                LocalDate.of(2026, 10, 29), LocalDate.of(2026, 11, 29),
                "CT286 Invoicing", "", "", "Công ty TNHH Công nghệ Thành Công - Chi nhánh phía Nam",
                "0312345678", "123 Đường Nguyễn Huệ, Phường Bến Nghé, Thành phố Hồ Chí Minh",
                "paid", "Giao hàng tại kho bên mua", lines, taxes, untaxed, tax, total);
    }
}
