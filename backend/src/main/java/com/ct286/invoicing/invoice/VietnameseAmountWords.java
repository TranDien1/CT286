package com.ct286.invoicing.invoice;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public final class VietnameseAmountWords {
    private static final String[] DIGITS = {"không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"};
    private static final String[] UNITS = {"", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"};

    private VietnameseAmountWords() { }

    public static String of(BigDecimal amount) {
        long value = amount.longValueExact();
        if (value < 0) throw new IllegalArgumentException("Số tiền không được âm.");
        if (value == 0) return "Không đồng";
        List<Integer> groups = new ArrayList<>();
        while (value > 0) {
            groups.add((int) (value % 1000));
            value /= 1000;
        }
        if (groups.size() > UNITS.length) throw new IllegalArgumentException("Số tiền vượt phạm vi đọc bằng chữ.");
        List<String> parts = new ArrayList<>();
        for (int i = groups.size() - 1; i >= 0; i--) {
            int group = groups.get(i);
            if (group == 0) continue;
            String words = readGroup(group, i < groups.size() - 1);
            parts.add(words + (UNITS[i].isEmpty() ? "" : " " + UNITS[i]));
        }
        String result = String.join(" ", parts) + " đồng";
        return Character.toUpperCase(result.charAt(0)) + result.substring(1);
    }

    private static String readGroup(int value, boolean full) {
        List<String> words = new ArrayList<>();
        int hundreds = value / 100;
        int tens = (value / 10) % 10;
        int units = value % 10;
        if (hundreds > 0) {
            words.add(DIGITS[hundreds]);
            words.add("trăm");
        } else if (full && value < 100) {
            words.add("không trăm");
        }
        if (tens > 1) {
            words.add(DIGITS[tens]);
            words.add("mươi");
        } else if (tens == 1) {
            words.add("mười");
        } else if (units > 0 && (hundreds > 0 || full)) {
            words.add("lẻ");
        }
        if (units > 0) {
            if (units == 1 && tens > 1) words.add("mốt");
            else if (units == 5 && tens > 0) words.add("lăm");
            else words.add(DIGITS[units]);
        }
        return String.join(" ", words);
    }
}
