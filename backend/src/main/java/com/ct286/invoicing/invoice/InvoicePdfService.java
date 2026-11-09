package com.ct286.invoicing.invoice;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class InvoicePdfService {
    record Download(byte[] pdf, String filename) { }
    private final InvoiceService invoices;
    private final JdbcTemplate jdbc;
    private final InvoicePdfRenderer renderer;
    private final String companyName;
    private final String companyVat;
    private final String companyAddress;

    InvoicePdfService(InvoiceService invoices, JdbcTemplate jdbc, InvoicePdfRenderer renderer,
                      @Value("${app.invoice.seller.name:CT286 Invoicing}") String companyName,
                      @Value("${app.invoice.seller.vat:}") String companyVat,
                      @Value("${app.invoice.seller.address:}") String companyAddress) {
        this.invoices = invoices;
        this.jdbc = jdbc;
        this.renderer = renderer;
        this.companyName = companyName;
        this.companyVat = companyVat;
        this.companyAddress = companyAddress;
    }

    @Transactional(readOnly = true)
    Download download(int id, UserDto actor) {
        if (actor == null || !"accountant".equals(actor.role()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ kế toán được in hóa đơn.");
        InvoiceDto invoice = invoices.get(id);
        boolean purchase = "in_invoice".equals(invoice.entryType());
        if (!purchase && !"out_invoice".equals(invoice.entryType()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Loại hóa đơn không hỗ trợ in PDF.");
        if (!"posted".equals(invoice.state()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ in được hóa đơn đã ghi sổ.");
        String number = invoice.name() == null ? Integer.toString(id) : invoice.name();
        String filename = "hoa-don-" + (purchase ? "mua-" : "ban-")
                + number.replaceAll("[^A-Za-z0-9._-]", "-") + ".pdf";
        return new Download(renderer.render(prepare(invoice)), filename);
    }

    InvoicePdfData prepare(InvoiceDto invoice) {
        boolean purchase = "in_invoice".equals(invoice.entryType());
        Party partner = partner(invoice);
        Party company = new Party(companyName, companyVat, companyAddress);
        Party seller = purchase ? partner : company;
        Party buyer = purchase ? company : partner;
        Map<Integer, BigDecimal> taxRates = taxRates();
        List<InvoicePdfData.Line> lines = invoice.items().stream()
                .filter(item -> "product".equals(item.displayType()))
                .map(item -> new InvoicePdfData.Line(item.name(), item.quantity(), item.priceUnit(),
                        taxRates.get(item.taxId()), purchase ? item.debit() : item.credit()))
                .toList();
        if (lines.isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hóa đơn không có dòng hàng để in.");
        Map<String, BigDecimal> taxTotals = new LinkedHashMap<>();
        invoice.items().stream().filter(item -> "tax".equals(item.displayType()))
                .forEach(item -> taxTotals.merge(item.name() == null ? "Thuế" : item.name(),
                        purchase ? item.debit() : item.credit(), BigDecimal::add));
        List<InvoicePdfData.TaxTotal> taxes = taxTotals.entrySet().stream()
                .map(e -> new InvoicePdfData.TaxTotal(e.getKey(), e.getValue())).toList();
        return new InvoicePdfData(invoice.name(), purchase ? "HÓA ĐƠN MUA HÀNG" : "HÓA ĐƠN BÁN HÀNG",
                invoice.invoiceDate(), invoice.invoiceDateDue(),
                seller.name(), seller.vat(), seller.address(), buyer.name(), buyer.vat(), buyer.address(),
                invoice.paymentState(), invoice.notes(), lines, taxes, invoice.amountUntaxed(),
                invoice.amountTax(), invoice.amountTotal());
    }

    private record Party(String name, String vat, String address) { }

    private Party partner(InvoiceDto invoice) {
        if (invoice.partner() == null) return new Party("", "", "");
        return jdbc.query("SELECT name,vat,address,city FROM dbo.Partner WHERE id=?",
                (rs, row) -> {
                    String address = rs.getString("address");
                    String city = rs.getString("city");
                    String fullAddress = address == null ? "" : address.trim();
                    if (city != null && !city.isBlank())
                        fullAddress += (fullAddress.isEmpty() ? "" : ", ") + city.trim();
                    return new Party(rs.getString("name"), rs.getString("vat"), fullAddress);
                }, invoice.partner().id()).stream().findFirst()
                .orElse(new Party(invoice.partner().name(), "", ""));
    }

    private Map<Integer, BigDecimal> taxRates() {
        Map<Integer, BigDecimal> rates = new LinkedHashMap<>();
        jdbc.query("SELECT id,amount FROM dbo.Tax", rs -> {
            rates.put(rs.getInt("id"), rs.getBigDecimal("amount"));
        });
        return rates;
    }
}
