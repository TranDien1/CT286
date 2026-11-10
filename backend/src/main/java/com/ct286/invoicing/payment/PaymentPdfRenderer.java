package com.ct286.invoicing.payment;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class PaymentPdfRenderer {
    private static final float LEFT = 48;
    private static final float RIGHT = 547;
    private static final Color INK = new Color(29, 43, 57);
    private static final Color MUTED = new Color(91, 105, 118);
    private static final Color ACCENT = new Color(36, 111, 121);
    private static final Color PALE = new Color(239, 245, 246);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private final String companyName;

    PaymentPdfRenderer(@Value("${app.invoice.seller.name:CT286 Invoicing}") String companyName) {
        this.companyName = companyName;
    }

    byte[] render(PaymentDetailDto data) {
        String title = "inbound".equals(data.paymentType()) ? "PHIẾU THU" : "PHIẾU CHI";
        try (PDDocument document = new PDDocument()) {
            document.getDocumentInformation().setTitle(title + " " + value(data.name()));
            PDFont regular = font(document,"/fonts/NotoSans-Regular.ttf");
            PDFont bold = font(document,"/fonts/NotoSans-Bold.ttf");
            try (Canvas c = new Canvas(document,regular,bold)) {
                c.draw(data,title,companyName);
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể tạo PDF phiếu thu/chi.",ex);
        }
    }

    private PDFont font(PDDocument document, String resource) throws IOException {
        try (InputStream stream = getClass().getResourceAsStream(resource)) {
            if (stream == null) throw new IOException("Thiếu font PDF: " + resource);
            return PDType0Font.load(document,stream);
        }
    }

    private static String value(String text) { return text == null ? "" : text.trim(); }
    private static String date(LocalDate date) { return date == null ? "" : DATE.format(date); }
    private static String dateTime(LocalDateTime date) { return date == null ? "" : DATE_TIME.format(date); }
    private static String money(BigDecimal amount) {
        if (amount == null) return "";
        DecimalFormat format = new DecimalFormat("#,##0.##",DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        return format.format(amount) + " đ";
    }

    private static final class Canvas implements AutoCloseable {
        private final PDDocument document;
        private final PDFont regular;
        private final PDFont bold;
        private PDPageContentStream stream;
        private float y;
        private String title;
        private String number;

        Canvas(PDDocument document, PDFont regular, PDFont bold) throws IOException {
            this.document = document;
            this.regular = regular;
            this.bold = bold;
            openPage();
        }

        void draw(PaymentDetailDto data, String title, String companyName) throws IOException {
            this.title = title;
            this.number = value(data.name());
            text(value(companyName),LEFT,795,bold,12,ACCENT);
            text(title,LEFT,755,bold,22,ACCENT);
            text("Số phiếu: " + number,LEFT,731,regular,11,INK);
            rule(710);
            y = 685;
            text("Ngày " + ("inbound".equals(data.paymentType()) ? "thu" : "chi") + ": " + date(data.paymentDate()),LEFT,y,regular,10,INK);
            text("Lập lúc: " + dateTime(data.createdAt()),315,y,regular,9.5f,MUTED);
            y -= 29;
            field("Đối tác",data.partner() == null ? "" : data.partner().name());
            if (!value(data.partnerVat()).isEmpty()) field("MST",data.partnerVat());
            if (!value(data.partnerAddress()).isEmpty()) field("Địa chỉ",data.partnerAddress());
            field("Hóa đơn liên quan",data.invoiceName());
            field("Lý do",data.reason());
            ensureSpace(34);
            y -= 4;
            text("Số tiền",LEFT,y,bold,10,INK);
            rightFit(money(data.amount()),162,RIGHT,y,bold,14,ACCENT);
            y -= 26;
            field("Bằng chữ",data.amountWords());
            field("Hình thức","Tiền mặt");
            field("Sổ nhật ký",data.journal() == null ? "" : data.journal().code() + " - " + data.journal().name());
            field("Người lập",data.createdBy() == null ? "" : data.createdBy().name());
            field("Trạng thái",("posted".equals(data.state()) ? "Đã ghi sổ" : value(data.state()))
                    + (data.reconciled() ? " · Đã đối soát" : " · Chưa đối soát"));
            y -= 6;
            table(data.items());
            closeCurrent();
            int pages = document.getNumberOfPages();
            for (int i = 0; i < pages; i++) {
                try (PDPageContentStream footer = new PDPageContentStream(document,document.getPage(i),
                        PDPageContentStream.AppendMode.APPEND,true,true)) {
                    stream = footer;
                    rule(57);
                    text(value(companyName),LEFT,39,regular,8,MUTED);
                    right("Trang " + (i + 1) + " / " + pages,RIGHT,39,regular,8,MUTED);
                }
            }
            stream = null;
        }

        private void field(String label, String content) throws IOException {
            List<String> lines = wrap(value(content),regular,10,RIGHT - 162);
            float height = Math.max(27,lines.size() * 15 + 9);
            ensureSpace(height);
            text(label + ":",LEFT,y,bold,9.5f,MUTED);
            for (int i = 0; i < lines.size(); i++) text(lines.get(i),162,y - i * 15,regular,10,INK);
            y -= height;
        }

        private void table(List<PaymentDetailDto.Item> items) throws IOException {
            float required = 26 + 19 + 20;
            for (PaymentDetailDto.Item item : items) {
                required += Math.max(36,Math.max(
                        wrap(value(item.accountCode()) + " " + value(item.accountName()),regular,9,121).size(),
                        wrap(value(item.label()),regular,9,180).size()) * 13 + 15);
            }
            ensureSpace(required);
            fill(LEFT,y - 26,RIGHT - LEFT,26,PALE);
            text("Tài khoản",LEFT + 7,y - 17,bold,9,INK);
            text("Diễn giải",180,y - 17,bold,9,INK);
            right("Nợ",457,y - 17,bold,9,INK);
            right("Có",RIGHT - 6,y - 17,bold,9,INK);
            y -= 26;
            BigDecimal debitTotal = BigDecimal.ZERO;
            BigDecimal creditTotal = BigDecimal.ZERO;
            for (PaymentDetailDto.Item item : items) {
                List<String> account = wrap(value(item.accountCode()) + " " + value(item.accountName()),regular,9,121);
                List<String> description = wrap(value(item.label()),regular,9,180);
                float height = Math.max(36,Math.max(account.size(),description.size()) * 13 + 15);
                for (int i = 0; i < account.size(); i++) text(account.get(i),LEFT + 7,y - 17 - i * 13,regular,9,INK);
                for (int i = 0; i < description.size(); i++) text(description.get(i),180,y - 17 - i * 13,regular,9,INK);
                rightFit(item.debit().signum() == 0 ? "" : money(item.debit()),374,457,y - 17,regular,9,INK);
                rightFit(item.credit().signum() == 0 ? "" : money(item.credit()),463,RIGHT - 6,y - 17,regular,9,INK);
                debitTotal = debitTotal.add(item.debit());
                creditTotal = creditTotal.add(item.credit());
                y -= height;
                rule(y);
            }
            y -= 19;
            text("Tổng",LEFT + 7,y,bold,9.5f,INK);
            rightFit(money(debitTotal),374,457,y,bold,9.5f,ACCENT);
            rightFit(money(creditTotal),463,RIGHT - 6,y,bold,9.5f,ACCENT);
        }

        private void ensureSpace(float height) throws IOException {
            if (y - height >= 85) return;
            closeCurrent();
            openPage();
            text(title + " (tiếp)",LEFT,792,bold,14,ACCENT);
            text("Số phiếu: " + number,LEFT,770,regular,10,MUTED);
            y = 740;
            if (y - height < 85) throw new IOException("Nội dung phiếu vượt chiều cao trang PDF.");
        }

        private void openPage() throws IOException {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document,page);
        }

        private void closeCurrent() throws IOException {
            if (stream != null) { stream.close(); stream = null; }
        }

        private List<String> wrap(String source, PDFont font, float size, float width) throws IOException {
            String clean = value(source).replaceAll("[\\r\\n\\t]+"," ").replaceAll(" {2,}"," ");
            if (clean.isEmpty()) return List.of("-");
            List<String> result = new ArrayList<>();
            StringBuilder line = new StringBuilder();
            for (String word : clean.split(" ")) {
                String candidate = line.isEmpty() ? word : line + " " + word;
                if (textWidth(candidate,font,size) <= width) { line.setLength(0); line.append(candidate); continue; }
                if (!line.isEmpty()) { result.add(line.toString()); line.setLength(0); }
                for (int offset = 0; offset < word.length();) {
                    int end = offset;
                    while (end < word.length() && textWidth(word.substring(offset,end + 1),font,size) <= width) end++;
                    if (end == offset) end++;
                    String part = word.substring(offset,end);
                    if (end == word.length()) line.append(part); else result.add(part);
                    offset = end;
                }
            }
            if (!line.isEmpty()) result.add(line.toString());
            return result;
        }

        private float textWidth(String text, PDFont font, float size) throws IOException {
            return font.getStringWidth(text) * size / 1000;
        }
        private void text(String value, float x, float baseline, PDFont font, float size, Color color) throws IOException {
            String clean = value(value);
            if (clean.isEmpty()) return;
            stream.beginText();
            stream.setFont(font,size);
            stream.setNonStrokingColor(color);
            stream.newLineAtOffset(x,baseline);
            stream.showText(clean);
            stream.endText();
        }
        private void right(String value, float edge, float baseline, PDFont font, float size, Color color) throws IOException {
            text(value,edge - textWidth(value,font,size),baseline,font,size,color);
        }
        private void rightFit(String value, float left, float edge, float baseline, PDFont font, float size, Color color) throws IOException {
            if (value.isEmpty()) return;
            float width = textWidth(value,font,size);
            float fitted = width > edge - left ? size * (edge - left) / width : size;
            right(value,edge,baseline,font,fitted,color);
        }
        private void fill(float x, float y, float width, float height, Color color) throws IOException {
            stream.setNonStrokingColor(color);
            stream.addRect(x,y,width,height);
            stream.fill();
        }
        private void rule(float baseline) throws IOException {
            stream.setStrokingColor(new Color(212,224,226));
            stream.setLineWidth(0.6f);
            stream.moveTo(LEFT,baseline);
            stream.lineTo(RIGHT,baseline);
            stream.stroke();
        }
        @Override public void close() throws IOException { closeCurrent(); }
    }
}
