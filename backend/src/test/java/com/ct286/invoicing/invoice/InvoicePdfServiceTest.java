package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class InvoicePdfServiceTest {
    private final InvoiceService invoices = mock(InvoiceService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final InvoicePdfRenderer renderer = mock(InvoicePdfRenderer.class);
    private final InvoicePdfService service = new InvoicePdfService(invoices, jdbc, renderer,
            "CT286 Invoicing", "", "");
    private final UserDto accountant = new UserDto(1, "kt", "Kế toán", null, null, "accountant", true);
    private final UserDto admin = new UserDto(2, "admin", "Admin", null, null, "admin", true);

    @Test void restrictsRoleTypeAndPostedState() {
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> service.download(7, admin)).getStatusCode());
        verifyNoInteractions(invoices, jdbc, renderer);

        when(invoices.get(7)).thenReturn(invoice("other", "posted", "not_paid"));
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.download(7, accountant)).getStatusCode());
        when(invoices.get(7)).thenReturn(invoice("out_invoice", "draft", "not_paid"));
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.download(7, accountant)).getStatusCode());
        when(invoices.get(7)).thenReturn(invoice("in_invoice", "draft", "not_paid"));
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.download(7, accountant)).getStatusCode());
        verifyNoInteractions(jdbc, renderer);
    }

    @Test void usesPostedAccountingItemsAndAllowsPaidInvoice() throws Exception {
        when(invoices.get(7)).thenReturn(invoice("out_invoice", "posted", "paid"));
        when(renderer.render(any())).thenReturn(new byte[]{37, 80, 68, 70});
        stubCatalog();

        InvoicePdfService.Download result = service.download(7, accountant);

        assertEquals("hoa-don-ban-INV-2026-0007.pdf", result.filename());
        assertArrayEquals(new byte[]{37, 80, 68, 70}, result.pdf());
        ArgumentCaptor<InvoicePdfData> capture = ArgumentCaptor.forClass(InvoicePdfData.class);
        verify(renderer).render(capture.capture());
        InvoicePdfData data = capture.getValue();
        assertEquals("HÓA ĐƠN BÁN HÀNG", data.title());
        assertEquals("CT286 Invoicing", data.sellerName());
        assertEquals("Công ty TNHH Công nghệ Thành Công", data.buyerName());
        assertEquals("1 Nguyễn Huệ, TP. Hồ Chí Minh", data.buyerAddress());
        assertEquals("paid", data.paymentState());
        assertEquals(new BigDecimal("100100"), data.lines().getFirst().subtotal());
        assertEquals(new BigDecimal("7.1250"), data.lines().getFirst().taxRate());
        assertEquals(new BigDecimal("7132"), data.taxes().getFirst().amount());
        assertEquals(new BigDecimal("107232"), data.total());
    }

    @Test void printsPaidPurchaseUsingDebitAndSupplierAsSeller() throws Exception {
        when(invoices.get(8)).thenReturn(purchaseInvoice());
        when(renderer.render(any())).thenReturn(new byte[]{37, 80, 68, 70});
        stubCatalog();

        InvoicePdfService.Download result = service.download(8, accountant);

        assertEquals("hoa-don-mua-BILL-2026-0008.pdf", result.filename());
        ArgumentCaptor<InvoicePdfData> capture = ArgumentCaptor.forClass(InvoicePdfData.class);
        verify(renderer).render(capture.capture());
        InvoicePdfData data = capture.getValue();
        assertEquals("HÓA ĐƠN MUA HÀNG", data.title());
        assertEquals("Công ty TNHH Công nghệ Thành Công", data.sellerName());
        assertEquals("0312345678", data.sellerVat());
        assertEquals("1 Nguyễn Huệ, TP. Hồ Chí Minh", data.sellerAddress());
        assertEquals("CT286 Invoicing", data.buyerName());
        assertEquals("", data.buyerVat());
        assertEquals("paid", data.paymentState());
        assertEquals(new BigDecimal("100100"), data.lines().getFirst().subtotal());
        assertEquals(new BigDecimal("7132"), data.taxes().getFirst().amount());
        assertEquals(new BigDecimal("107232"), data.total());
    }

    private void stubCatalog() throws Exception {
        ResultSet tax = mock(ResultSet.class);
        when(tax.getInt("id")).thenReturn(3);
        when(tax.getBigDecimal("amount")).thenReturn(new BigDecimal("7.1250"));
        doAnswer(invocation -> {
            invocation.getArgument(1, RowCallbackHandler.class).processRow(tax);
            return null;
        }).when(jdbc).query(eq("SELECT id,amount FROM dbo.Tax"), any(RowCallbackHandler.class));
        ResultSet partner = mock(ResultSet.class);
        when(partner.getString("name")).thenReturn("Công ty TNHH Công nghệ Thành Công");
        when(partner.getString("vat")).thenReturn("0312345678");
        when(partner.getString("address")).thenReturn("1 Nguyễn Huệ");
        when(partner.getString("city")).thenReturn("TP. Hồ Chí Minh");
        when(jdbc.query(startsWith("SELECT name,vat,address,city"), any(RowMapper.class), eq(9)))
                .thenAnswer(invocation -> List.of(invocation.getArgument(1, RowMapper.class).mapRow(partner, 0)));

    }

    private InvoiceDto purchaseInvoice() {
        InvoiceDto.Item product = new InvoiceDto.Item(20, "product", 5, "156", "Máy in laser",
                5, 3, null, new BigDecimal("1.001"), new BigDecimal("100000"),
                new BigDecimal("100100"), BigDecimal.ZERO, false);
        InvoiceDto.Item tax = new InvoiceDto.Item(21, "tax", 7, "1331", "Thuế GTGT được khấu trừ 7,125%",
                null, null, 3, null, null, new BigDecimal("7132"), BigDecimal.ZERO, false);
        InvoiceDto.Item payable = new InvoiceDto.Item(22, "payment_term", 3, "331", "Phải trả nhà cung cấp",
                null, null, null, null, null, BigDecimal.ZERO, new BigDecimal("107232"), false);
        return new InvoiceDto(8, "BILL/2026/0008", "in_invoice", "posted", null,
                new InvoiceDto.Reference(9, "Tên cũ", null), null,
                LocalDate.of(2026, 10, 29), LocalDate.of(2026, 11, 29), LocalDate.of(2026, 10, 29),
                new BigDecimal("100100"), new BigDecimal("7132"), new BigDecimal("107232"),
                "paid", "Nhập hàng tại kho", LocalDateTime.of(2026, 10, 29, 9, 0),
                List.of(new InvoiceDto.Line(20, 5, new BigDecimal("1.001"), new BigDecimal("100000"), 3)),
                List.of(product, tax, payable));
    }

    private InvoiceDto invoice(String type, String state, String paymentState) {
        InvoiceDto.Item product = new InvoiceDto.Item(10, "product", 4, "511", "Máy in laser",
                5, 3, null, new BigDecimal("1.001"), new BigDecimal("100000"),
                BigDecimal.ZERO, new BigDecimal("100100"), false);
        InvoiceDto.Item tax = new InvoiceDto.Item(11, "tax", 6, "3331", "Thuế GTGT phải nộp 7,125%",
                null, null, 3, null, null, BigDecimal.ZERO, new BigDecimal("7132"), false);
        InvoiceDto.Item receivable = new InvoiceDto.Item(12, "payment_term", 2, "131", "Phải thu khách hàng",
                null, null, null, null, null, new BigDecimal("107232"), BigDecimal.ZERO, false);
        return new InvoiceDto(7, "INV/2026/0007", type, state, null,
                new InvoiceDto.Reference(9, "Tên cũ", null), null,
                LocalDate.of(2026, 10, 29), LocalDate.of(2026, 11, 29), LocalDate.of(2026, 10, 29),
                new BigDecimal("100100"), new BigDecimal("7132"), new BigDecimal("107232"),
                paymentState, "Giao hàng tại kho", LocalDateTime.of(2026, 10, 29, 9, 0),
                List.of(new InvoiceDto.Line(10, 5, new BigDecimal("1.001"), new BigDecimal("100000"), 3)),
                List.of(product, tax, receivable));
    }
}
