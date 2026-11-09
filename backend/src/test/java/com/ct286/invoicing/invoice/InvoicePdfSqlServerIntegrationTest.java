package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.List;
import java.util.Locale;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional(readOnly = true)
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class InvoicePdfSqlServerIntegrationTest {
    @Autowired InvoicePdfService pdfService;
    @Autowired InvoiceService invoiceService;
    @Autowired JdbcTemplate jdbc;

    @Test void printsExistingPostedSaleFromSqlServerWithoutChangingData() throws Exception {
        List<Integer> ids = jdbc.query("""
                SELECT TOP 1 id FROM dbo.Journal_Entry
                WHERE entry_type='out_invoice' AND state='posted' ORDER BY id
                """, (rs, row) -> rs.getInt(1));
        assertFalse(ids.isEmpty(), "Test database cần ít nhất một hóa đơn bán đã ghi sổ.");
        int id = ids.getFirst();
        InvoiceDto invoice = invoiceService.get(id);
        UserDto accountant = new UserDto(0, "test", "Kế toán kiểm thử", null, null, "accountant", true);
        byte[] bytes = pdfService.download(id, accountant).pdf();
        try (var document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document);
            DecimalFormat format = new DecimalFormat("#,##0.##",
                    DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
            assertTrue(text.contains(invoice.name()));
            assertTrue(text.contains(format.format(invoice.amountTotal()) + " đ"));
            assertTrue(text.contains("HÓA ĐƠN BÁN HÀNG"));
        }
    }

    @Test void printsExistingPostedPurchaseFromSqlServerWithoutChangingData() throws Exception {
        List<Integer> ids = jdbc.query("""
                SELECT TOP 1 id FROM dbo.Journal_Entry
                WHERE entry_type='in_invoice' AND state='posted' ORDER BY id
                """, (rs, row) -> rs.getInt(1));
        assertFalse(ids.isEmpty(), "Test database cần ít nhất một hóa đơn mua đã ghi sổ.");
        int id = ids.getFirst();
        InvoiceDto invoice = invoiceService.get(id);
        InvoicePdfData data = pdfService.prepare(invoice);
        assertEquals("HÓA ĐƠN MUA HÀNG", data.title());
        assertEquals(invoice.partner().name(), data.sellerName());
        assertEquals("CT286 Invoicing", data.buyerName());
        assertEquals(invoice.amountUntaxed(), data.lines().stream()
                .map(InvoicePdfData.Line::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add));
        assertEquals(invoice.amountTax(), data.taxes().stream()
                .map(InvoicePdfData.TaxTotal::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
        UserDto accountant = new UserDto(0, "test", "Kế toán kiểm thử", null, null, "accountant", true);
        InvoicePdfService.Download download = pdfService.download(id, accountant);
        assertTrue(download.filename().startsWith("hoa-don-mua-BILL-"));
        try (var document = Loader.loadPDF(download.pdf())) {
            String text = new PDFTextStripper().getText(document);
            DecimalFormat format = new DecimalFormat("#,##0.##",
                    DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
            assertTrue(text.contains(invoice.name()));
            assertTrue(text.contains(format.format(invoice.amountTotal()) + " đ"));
            assertTrue(text.contains("HÓA ĐƠN MUA HÀNG"));
        }
    }
}
