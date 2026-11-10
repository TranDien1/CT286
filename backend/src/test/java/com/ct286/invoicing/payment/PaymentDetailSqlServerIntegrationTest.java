package com.ct286.invoicing.payment;

import static org.junit.jupiter.api.Assertions.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.util.List;
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
class PaymentDetailSqlServerIntegrationTest {
    @Autowired PaymentService payments;
    @Autowired PaymentPdfService pdfs;
    @Autowired JdbcTemplate jdbc;

    @Test void readsReceiptAndDisbursementWithoutChangingSqlServer() throws Exception {
        int userId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' AND active=1 ORDER BY id",Integer.class);
        UserDto actor = new UserDto(userId,"test","Kế toán kiểm thử",null,null,"accountant",true);
        for (String type : List.of("inbound","outbound")) {
            int id = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Payment WHERE payment_type=? ORDER BY id",Integer.class,type);
            PaymentDetailDto detail = payments.detail(id,actor);
            assertEquals(type,detail.paymentType());
            assertEquals("posted",detail.state());
            assertEquals("CSH",detail.journal().code());
            assertEquals("Thanh toán đủ hóa đơn " + detail.invoiceName(),detail.reason());
            assertEquals(2,detail.items().size());
            assertTrue(detail.reconciled());
            BigDecimal debit = detail.items().stream().map(PaymentDetailDto.Item::debit).reduce(BigDecimal.ZERO,BigDecimal::add);
            BigDecimal credit = detail.items().stream().map(PaymentDetailDto.Item::credit).reduce(BigDecimal.ZERO,BigDecimal::add);
            assertEquals(0,detail.amount().compareTo(debit));
            assertEquals(0,detail.amount().compareTo(credit));
            var download = pdfs.download(id,actor);
            try (var document = Loader.loadPDF(download.pdf())) {
                String text = new PDFTextStripper().getText(document);
                assertTrue(text.contains(type.equals("inbound") ? "PHIẾU THU" : "PHIẾU CHI"));
                assertTrue(text.contains(detail.name()));
                assertTrue(text.contains(detail.invoiceName()));
            }
        }
    }

}
