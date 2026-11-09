package com.ct286.invoicing.invoice;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Component;

@Component
class InvoicePdfRenderer {
    private static final float LEFT = 48;
    private static final float RIGHT = 547;
    private static final float BOTTOM = 75;
    private static final Color INK = new Color(29, 43, 57);
    private static final Color MUTED = new Color(91, 105, 118);
    private static final Color ACCENT = new Color(36, 111, 121);
    private static final Color PALE = new Color(239, 245, 246);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    byte[] render(InvoicePdfData data) {
        try (PDDocument document = new PDDocument()) {
            document.getDocumentInformation().setTitle(data.title() + " " + display(data.number()));
            PDFont regular = loadFont(document, "/fonts/NotoSans-Regular.ttf");
            PDFont bold = loadFont(document, "/fonts/NotoSans-Bold.ttf");
            Canvas canvas = new Canvas(document, regular, bold);
            try {
                canvas.firstPage(data);
                for (InvoicePdfData.Line line : data.lines()) canvas.line(line, data);
                canvas.summary(data);
                canvas.close();
                canvas.footers(data);
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                document.save(output);
                return output.toByteArray();
            } finally {
                canvas.close();
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể tạo PDF hóa đơn.", ex);
        }
    }

    private PDFont loadFont(PDDocument document, String resource) throws IOException {
        try (InputStream stream = getClass().getResourceAsStream(resource)) {
            if (stream == null) throw new IOException("Thiếu font PDF: " + resource);
            return PDType0Font.load(document, stream);
        }
    }

    private static String display(String value) { return value == null ? "" : value.trim(); }
    private static String date(LocalDate value) { return value == null ? "" : DATE.format(value); }
    private static String decimal(BigDecimal value) {
        if (value == null) return "";
        DecimalFormat format = new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        format.setGroupingUsed(true);
        return format.format(value);
    }
    private static String quantity(BigDecimal value) {
        if (value == null) return "";
        DecimalFormat format = new DecimalFormat("#,##0.###", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        return format.format(value);
    }
    private static String money(BigDecimal value) { return decimal(value) + " đ"; }
    private static String rate(BigDecimal value) {
        if (value == null) return "-";
        DecimalFormat format = new DecimalFormat("#,##0.####", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        return format.format(value) + "%";
    }

    private static final class Canvas implements AutoCloseable {
        private final PDDocument document;
        private final PDFont regular;
        private final PDFont bold;
        private PDPage page;
        private PDPageContentStream stream;
        private float y;

        Canvas(PDDocument document, PDFont regular, PDFont bold) {
            this.document = document;
            this.regular = regular;
            this.bold = bold;
        }

        void firstPage(InvoicePdfData data) throws IOException {
            openPage();
            text("BÊN BÁN", LEFT, 795, bold, 9, ACCENT);
            text("BÊN MUA", 315, 795, bold, 9, ACCENT);
            float sellerY = block(data.sellerName(), LEFT, 775, 225, bold, 12, 15);
            if (!display(data.sellerVat()).isEmpty()) {
                text("MST: " + display(data.sellerVat()), LEFT, sellerY, regular, 9.5f, INK);
                sellerY -= 15;
            }
            if (!display(data.sellerAddress()).isEmpty())
                sellerY = block(data.sellerAddress(), LEFT, sellerY, 225, regular, 9.5f, 13);
            float buyerY = block(data.buyerName(), 315, 775, 232, bold, 11, 14);
            if (!display(data.buyerVat()).isEmpty()) {
                text("MST: " + display(data.buyerVat()), 315, buyerY, regular, 9.5f, INK);
                buyerY -= 15;
            }
            if (!display(data.buyerAddress()).isEmpty())
                buyerY = block(data.buyerAddress(), 315, buyerY, 232, regular, 9.5f, 13);
            float separator = Math.min(705, Math.min(sellerY, buyerY) - 6);
            rule(LEFT, RIGHT, separator, new Color(212, 224, 226));
            text(data.title(), LEFT, separator - 33, bold, 20, ACCENT);
            text("Số: " + display(data.number()), LEFT, separator - 56, regular, 11, INK);
            text("Ngày lập: " + date(data.invoiceDate()), LEFT, separator - 84, regular, 10, INK);
            text("Ngày đến hạn: " + date(data.dueDate()), 315, separator - 84, regular, 10, INK);
            tableHeader(separator - 101);
        }

        private void continuation(InvoicePdfData data, boolean table) throws IOException {
            openPage();
            text(data.title() + " (tiếp)", LEFT, 792, bold, 14, ACCENT);
            text("Số: " + display(data.number()), LEFT, 772, regular, 10, MUTED);
            if (table) tableHeader(750);
            else y = 746;
        }

        private void openPage() throws IOException {
            close();
            page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
        }

        private void tableHeader(float top) throws IOException {
            fillRect(LEFT, top - 26, RIGHT - LEFT, 26, PALE);
            text("Diễn giải", LEFT + 7, top - 17, bold, 9, INK);
            right("Số lượng", 319, top - 17, bold, 9, INK);
            right("Đơn giá", 401, top - 17, bold, 9, INK);
            right("Thuế", 458, top - 17, bold, 9, INK);
            right("Thành tiền", RIGHT - 6, top - 17, bold, 9, INK);
            y = top - 26;
        }

        void line(InvoicePdfData.Line item, InvoicePdfData data) throws IOException {
            List<String> descriptions = wrap(display(item.description()), regular, 9.5f, 205);
            float rowHeight = Math.max(34, 14 * descriptions.size() + 14);
            if (y - rowHeight < BOTTOM) continuation(data, true);
            float baseline = y - 18;
            for (int i = 0; i < descriptions.size(); i++)
                text(descriptions.get(i), LEFT + 7, baseline - i * 14, regular, 9.5f, INK);
            rightFit(quantity(item.quantity()), 269, 319, baseline, regular, 9.5f, INK);
            rightFit(decimal(item.unitPrice()), 326, 401, baseline, regular, 9.5f, INK);
            rightFit(rate(item.taxRate()), 408, 458, baseline, regular, 9.5f, INK);
            rightFit(money(item.subtotal()), 466, RIGHT - 6, baseline, regular, 9.5f, INK);
            y -= rowHeight;
            rule(LEFT, RIGHT, y, new Color(229, 235, 236));
        }

        void summary(InvoicePdfData data) throws IOException {
            int taxRows = Math.max(1, data.taxes().size());
            if (y - (taxRows + 2) * 25 - 76 < BOTTOM) continuation(data, false);
            y -= 23;
            summaryRow("Cộng tiền hàng", data.untaxed(), false, data);
            if (data.taxes().isEmpty()) summaryRow("Thuế GTGT", data.tax(), false, data);
            else for (InvoicePdfData.TaxTotal tax : data.taxes()) summaryRow(tax.name(), tax.amount(), false, data);
            rule(315, RIGHT, y + 16, new Color(187, 202, 205));
            summaryRow("Tổng thanh toán", data.total(), true, data);
            y -= 13;
            ensure(47, data);
            text("Tổng tiền bằng chữ:", LEFT, y, bold, 10, INK);
            y -= 17;
            for (String row : wrap(VietnameseAmountWords.of(data.total()), regular, 10, RIGHT - LEFT)) {
                ensure(16, data);
                text(row, LEFT, y, regular, 10, INK);
                y -= 16;
            }
            y -= 8;
            ensure(18, data);
            text("Nội dung thanh toán: " + display(data.number()), LEFT, y, regular, 9.5f, INK);
            y -= 18;
            if (!display(data.notes()).isEmpty()) {
                y -= 12;
                ensure(35, data);
                text("Ghi chú:", LEFT, y, bold, 10, INK);
                y -= 17;
                for (String row : wrap(data.notes(), regular, 9.5f, RIGHT - LEFT)) {
                    ensure(15, data);
                    text(row, LEFT, y, regular, 9.5f, INK);
                    y -= 15;
                }
            }
        }

        private void summaryRow(String label, BigDecimal amount, boolean total, InvoicePdfData data) throws IOException {
            PDFont font = total ? bold : regular;
            Color color = total ? ACCENT : INK;
            List<String> labelLines = wrap(display(label), font, 9.5f, 145);
            float height = Math.max(25, labelLines.size() * 13 + 8);
            ensure(height, data);
            for (int i = 0; i < labelLines.size(); i++)
                text(labelLines.get(i), 315, y - i * 13, font, 9.5f, color);
            rightFit(money(amount), 466, RIGHT, y, font, total ? 11 : 9.5f, color);
            y -= height;
        }

        private void ensure(float needed, InvoicePdfData data) throws IOException {
            if (y - needed < BOTTOM) continuation(data, false);
        }

        private void footers(InvoicePdfData data) throws IOException {
            int pages = document.getNumberOfPages();
            for (int i = 0; i < pages; i++) {
                PDPage current = document.getPage(i);
                try (PDPageContentStream footer = new PDPageContentStream(document, current,
                        PDPageContentStream.AppendMode.APPEND, true, true)) {
                    stream = footer;
                    rule(LEFT, RIGHT, 57, new Color(212, 224, 226));
                    text(display(data.sellerName()), LEFT, 39, regular, 8, MUTED);
                    right("Trang " + (i + 1) + " / " + pages, RIGHT, 39, regular, 8, MUTED);
                }
            }
            stream = null;
        }

        private float block(String value, float x, float baseline, float width, PDFont font,
                            float size, float lineHeight) throws IOException {
            List<String> lines = wrap(display(value), font, size, width);
            for (int i = 0; i < lines.size(); i++)
                text(lines.get(i), x, baseline - i * lineHeight, font, size, INK);
            return baseline - lines.size() * lineHeight;
        }

        private List<String> wrap(String value, PDFont font, float size, float width) throws IOException {
            String normalized = display(value).replaceAll("[\\r\\n\\t]+", " ").replaceAll(" {2,}", " ");
            if (normalized.isEmpty()) return List.of("");
            List<String> lines = new ArrayList<>();
            StringBuilder current = new StringBuilder();
            for (String word : normalized.split(" ")) {
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (textWidth(candidate, font, size) <= width) {
                    current.setLength(0);
                    current.append(candidate);
                    continue;
                }
                if (!current.isEmpty()) {
                    lines.add(current.toString());
                    current.setLength(0);
                }
                for (int offset = 0; offset < word.length();) {
                    int end = offset;
                    while (end < word.length() && textWidth(word.substring(offset, end + 1), font, size) <= width) end++;
                    if (end == offset) end++;
                    String part = word.substring(offset, end);
                    if (end == word.length()) current.append(part);
                    else lines.add(part);
                    offset = end;
                }
            }
            if (!current.isEmpty()) lines.add(current.toString());
            return lines;
        }

        private float textWidth(String value, PDFont font, float size) throws IOException {
            return font.getStringWidth(value) * size / 1000;
        }

        private void text(String value, float x, float baseline, PDFont font, float size, Color color) throws IOException {
            String clean = display(value);
            if (clean.isEmpty()) return;
            stream.beginText();
            stream.setFont(font, size);
            stream.setNonStrokingColor(color);
            stream.newLineAtOffset(x, baseline);
            stream.showText(clean);
            stream.endText();
        }

        private void right(String value, float right, float baseline, PDFont font, float size, Color color) throws IOException {
            text(value, right - textWidth(value, font, size), baseline, font, size, color);
        }

        private void rightFit(String value, float left, float right, float baseline,
                              PDFont font, float size, Color color) throws IOException {
            float width = textWidth(value, font, size);
            float fitSize = width > right - left ? size * (right - left) / width : size;
            right(value, right, baseline, font, fitSize, color);
        }

        private void fillRect(float x, float y, float width, float height, Color color) throws IOException {
            stream.setNonStrokingColor(color);
            stream.addRect(x, y, width, height);
            stream.fill();
        }

        private void rule(float x1, float x2, float y, Color color) throws IOException {
            stream.setStrokingColor(color);
            stream.setLineWidth(0.6f);
            stream.moveTo(x1, y);
            stream.lineTo(x2, y);
            stream.stroke();
        }

        @Override public void close() throws IOException {
            if (stream != null) {
                stream.close();
                stream = null;
            }
        }
    }
}
