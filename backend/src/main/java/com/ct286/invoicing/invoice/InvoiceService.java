package com.ct286.invoicing.invoice;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class InvoiceService {
    private static final BigDecimal MAX_MONEY = new BigDecimal("9999999999999999.99");
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999.999");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private final InvoiceRepository repo;
    InvoiceService(InvoiceRepository repo) { this.repo = repo; }
    record ComputedLine(InvoiceRepository.Product product, InvoiceRepository.Tax tax, InvoiceRequest.Line input, int accountId, BigDecimal subtotal, BigDecimal taxAmount) { }
    record Computed(List<ComputedLine> lines, BigDecimal untaxed, BigDecimal tax, BigDecimal total, int counterpartAccount, boolean purchase) { }

    @Transactional(readOnly = true)
    List<InvoiceDto> listSales() { return repo.salesIds().stream().map(this::get).toList(); }
    @Transactional(readOnly = true)
    List<InvoiceDto> listPurchases() { return repo.purchaseIds().stream().map(this::get).toList(); }
    @Transactional(readOnly = true)
    InvoiceDto get(int id) {
        return repo.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hóa đơn."));
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    InvoiceDto create(InvoiceRequest input, UserDto actor) {
        requireAccountant(actor);
        InvoiceRepository.Journal journal = repo.salesJournal().orElseThrow(() -> bad("Chưa cấu hình sổ bán INV."));
        InvoiceRequest request = normalize(input);
        Computed calculated = calculate(request, journal, null, false);
        int id = repo.insertHeader(request, journal.id(), actor.id(), calculated.untaxed(), calculated.tax(), calculated.total());
        insertItems(id, calculated);
        return get(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    InvoiceDto createPurchase(InvoiceRequest input, UserDto actor) {
        requireAccountant(actor);
        InvoiceRepository.Journal journal = journal(true);
        InvoiceRequest request = normalize(input);
        Computed calculated = calculate(request, journal, null, true);
        int id = repo.insertHeader(request,journal.id(),actor.id(),calculated.untaxed(),calculated.tax(),calculated.total(),"in_invoice");
        insertItems(id,calculated);
        return get(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    InvoiceDto update(int id, InvoiceRequest input, UserDto actor) {
        requireAccountant(actor);
        InvoiceDto old = get(id);
        if (!"draft".equals(old.state()) || !"not_paid".equals(old.paymentState()) || repo.hasPayment(id))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ sửa được hóa đơn nháp chưa thanh toán.");
        boolean purchase = "in_invoice".equals(old.entryType());
        InvoiceRepository.Journal journal = journal(purchase);
        if (journal.id() != old.journal().id()) throw bad("Sổ của hóa đơn không phù hợp với cấu hình.");
        InvoiceRequest request = normalize(input);
        Computed calculated = calculate(request, journal, old, purchase);
        repo.updateHeader(id,request,calculated.untaxed(),calculated.tax(),calculated.total());
        repo.deleteItems(id); insertItems(id,calculated);
        return get(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    InvoiceDto post(int id, UserDto actor) {
        requireAccountant(actor);
        InvoiceDto old = get(id);
        if (!"draft".equals(old.state()) || !"not_paid".equals(old.paymentState()) || repo.hasPayment(id))
            throw conflict("Chỉ ghi sổ được hóa đơn nháp chưa thanh toán.");
        if (old.lines().isEmpty()) throw bad("Hóa đơn phải có ít nhất một dòng hàng trước khi ghi sổ.");
        boolean purchase = "in_invoice".equals(old.entryType());
        InvoiceRepository.Journal journal = journal(purchase);
        if (journal.id() != old.journal().id()) throw bad("Sổ của hóa đơn không phù hợp với cấu hình.");
        InvoiceRequest request = normalize(new InvoiceRequest(old.partner() == null ? null : old.partner().id(),old.invoiceDate(),
                old.invoiceDateDue(),old.accountingDate(),old.notes(),old.lines().stream()
                .map(l -> new InvoiceRequest.Line(l.productId(),l.quantity(),l.priceUnit(),l.taxId())).toList()));
        Computed calculated = calculate(request,journal,old,purchase);
        String name = old.name() == null ? repo.nextNumber(journal.id(),request.accountingDate().getYear(),purchase ? "BILL" : "INV") : old.name();
        repo.updateHeader(id,request,calculated.untaxed(),calculated.tax(),calculated.total());
        repo.deleteItems(id); insertItems(id,calculated);
        repo.setState(id,"posted",name);
        return get(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    InvoiceDto reset(int id, UserDto actor) {
        requireAccountant(actor);
        InvoiceDto old = get(id);
        if (!"posted".equals(old.state()) || !"not_paid".equals(old.paymentState()) || repo.hasPayment(id))
            throw conflict("Chỉ chuyển về nháp được hóa đơn đã ghi sổ và chưa thanh toán.");
        repo.setState(id,"draft",old.name());
        return get(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    InvoiceDto cancel(int id, UserDto actor) {
        requireAccountant(actor);
        InvoiceDto old = get(id);
        if (!"draft".equals(old.state()) || !"not_paid".equals(old.paymentState()) || repo.hasPayment(id))
            throw conflict("Chỉ hủy được hóa đơn nháp chưa thanh toán.");
        repo.setState(id,"cancel",old.name());
        return get(id);
    }
    private InvoiceRequest normalize(InvoiceRequest r) {
        if (r == null || r.partnerId() == null) throw bad("Vui lòng chọn đối tác.");
        if (r.invoiceDate() == null || r.invoiceDateDue() == null || r.accountingDate() == null)
            throw bad("Vui lòng nhập ngày hóa đơn, hạn thanh toán và ngày hạch toán.");
        if (r.invoiceDateDue().isBefore(r.invoiceDate())) throw bad("Hạn thanh toán không được trước ngày hóa đơn.");
        if (r.accountingDate().isBefore(r.invoiceDate())) throw bad("Ngày hạch toán không được trước ngày hóa đơn.");
        String notes = r.notes() == null ? null : r.notes().trim();
        if (notes != null && notes.length() > 1000) throw bad("Ghi chú tối đa 1000 ký tự.");
        if (notes != null && notes.isEmpty()) notes = null;
        if (r.lines() == null) throw bad("Danh sách dòng hàng không hợp lệ.");
        return new InvoiceRequest(r.partnerId(),r.invoiceDate(),r.invoiceDateDue(),r.accountingDate(),notes,r.lines());
    }
    private InvoiceRepository.Journal journal(boolean purchase) {
        return (purchase ? repo.purchaseJournal() : repo.salesJournal())
                .orElseThrow(() -> bad(purchase ? "Chưa cấu hình sổ mua BILL." : "Chưa cấu hình sổ bán INV."));
    }
    private Computed calculate(InvoiceRequest request, InvoiceRepository.Journal journal, InvoiceDto old, boolean purchase) {
        InvoiceRepository.Partner partner = repo.partner(request.partnerId()).orElseThrow(() -> bad("Đối tác không tồn tại."));
        if (purchase ? !partner.supplier() : !partner.customer()) throw bad(purchase ? "Đối tác không phải nhà cung cấp." : "Đối tác không phải khách hàng.");
        if (!partner.active() && (old == null || old.partner() == null || old.partner().id() != partner.id())) throw bad("Đối tác đã ngừng hoạt động.");
        Integer counterpart = purchase ? repo.payableAccount() : repo.receivableAccount();
        if (counterpart == null) throw bad(purchase ? "Chưa cấu hình tài khoản công nợ 331 có đối soát." : "Chưa cấu hình tài khoản công nợ 131 có đối soát.");
        Set<Integer> previousProducts = old == null ? Set.of() : old.lines().stream().map(InvoiceDto.Line::productId).collect(Collectors.toSet());
        List<ComputedLine> computed = new ArrayList<>();
        BigDecimal untaxed = BigDecimal.ZERO, taxTotal = BigDecimal.ZERO;
        for (InvoiceRequest.Line line : request.lines()) {
            if (line == null || line.productId() == null || line.taxId() == null) throw bad("Mỗi dòng cần sản phẩm và thuế phù hợp.");
            validNumber(line.quantity(), MAX_QUANTITY, 3, true, "Số lượng");
            validNumber(line.priceUnit(), MAX_MONEY, 2, false, "Đơn giá");
            InvoiceRepository.Product product = repo.product(line.productId()).orElseThrow(() -> bad("Sản phẩm không tồn tại."));
            if (!product.active() && !previousProducts.contains(product.id())) throw bad("Sản phẩm đã ngừng hoạt động.");
            InvoiceRepository.Tax tax = repo.tax(line.taxId()).orElseThrow(() -> bad("Thuế không tồn tại."));
            if (!(purchase ? "purchase" : "sale").equals(tax.type()) || tax.rate().signum() < 0 || tax.rate().compareTo(HUNDRED) > 0) throw bad("Loại thuế không phù hợp với hóa đơn.");
            Integer categoryAccount = purchase ? product.purchaseAccountId() : product.salesAccountId();
            Integer account = categoryAccount != null ? categoryAccount : journal.defaultAccountId();
            if (account == null) throw bad("Chưa cấu hình tài khoản cho nhóm sản phẩm hoặc sổ nhật ký.");
            BigDecimal subtotal = line.quantity().multiply(line.priceUnit()).setScale(0, RoundingMode.HALF_UP);
            BigDecimal taxAmount = subtotal.multiply(tax.rate()).divide(HUNDRED).setScale(0, RoundingMode.HALF_UP);
            if (taxAmount.signum() != 0 && tax.accountId() == null) throw bad("Thuế chưa có tài khoản hạch toán.");
            untaxed = untaxed.add(subtotal); taxTotal = taxTotal.add(taxAmount);
            computed.add(new ComputedLine(product,tax,line,account,subtotal,taxAmount));
        }
        BigDecimal total = untaxed.add(taxTotal);
        if (total.compareTo(MAX_MONEY) > 0) throw bad("Tổng tiền vượt giới hạn database.");
        return new Computed(computed,untaxed,taxTotal,total,counterpart,purchase);
    }
    private void insertItems(int id, Computed computed) {
        Map<Integer, ComputedLine> taxes = new LinkedHashMap<>();
        Map<Integer, BigDecimal> amounts = new LinkedHashMap<>();
        for (ComputedLine line : computed.lines()) {
            repo.item(id,line.accountId(),line.product().id(),line.tax().id(),line.product().name(),"product",
                    line.input().quantity(),line.input().priceUnit(),computed.purchase() ? line.subtotal() : BigDecimal.ZERO,computed.purchase() ? BigDecimal.ZERO : line.subtotal(),null);
            taxes.putIfAbsent(line.tax().id(),line);
            amounts.merge(line.tax().id(),line.taxAmount(),BigDecimal::add);
        }
        for (var entry : amounts.entrySet()) {
            if (entry.getValue().signum() == 0) continue;
            ComputedLine line = taxes.get(entry.getKey());
            repo.item(id,line.tax().accountId(),null,null,line.tax().name(),"tax",null,null,computed.purchase() ? entry.getValue() : BigDecimal.ZERO,computed.purchase() ? BigDecimal.ZERO : entry.getValue(),line.tax().id());
        }
        repo.item(id,computed.counterpartAccount(),null,null,computed.purchase() ? "Phải trả nhà cung cấp" : "Phải thu khách hàng","payment_term",null,null,computed.purchase() ? BigDecimal.ZERO : computed.total(),computed.purchase() ? computed.total() : BigDecimal.ZERO,null);
    }
    private void validNumber(BigDecimal number, BigDecimal max, int scale, boolean positive, String label) {
        if (number == null || number.signum() < (positive ? 1 : 0) || number.compareTo(max) > 0 || number.stripTrailingZeros().scale() > scale)
            throw bad(label + " không hợp lệ hoặc vượt độ chính xác cho phép.");
    }
    private void requireAccountant(UserDto actor) {
        if (actor == null || !"accountant".equals(actor.role())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ kế toán được tạo và sửa hóa đơn.");
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT,message); }
}
