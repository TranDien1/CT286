package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class VietnameseAmountWordsTest {
    @Test void readsRoundedVndTotals() {
        assertEquals("Không đồng", VietnameseAmountWords.of(BigDecimal.ZERO));
        assertEquals("Sáu triệu ba trăm nghìn đồng", VietnameseAmountWords.of(new BigDecimal("6300000")));
        assertEquals("Một nghìn không trăm lẻ một đồng", VietnameseAmountWords.of(new BigDecimal("1001")));
        assertEquals("Một trăm lẻ bảy nghìn hai trăm ba mươi hai đồng", VietnameseAmountWords.of(new BigDecimal("107232")));
    }
}
