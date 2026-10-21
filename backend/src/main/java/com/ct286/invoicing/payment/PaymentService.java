package com.ct286.invoicing.payment;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentService {
    private final PaymentRepository repo;
    PaymentService(PaymentRepository repo) { this.repo = repo; }
    @Transactional(readOnly = true)
    public List<PaymentDto> list() { return repo.list(); }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public PaymentDto create(PaymentRequest request, UserDto actor) {
        if (actor == null || !"accountant".equals(actor.role())) throw status(HttpStatus.FORBIDDEN,"Chỉ kế toán được lập phiếu thu/chi.");
        if (request == null || request.invoiceId() == null || request.paymentDate() == null) throw status(HttpStatus.BAD_REQUEST,"Vui lòng chọn hóa đơn và ngày thanh toán.");
        PaymentRepository.Invoice invoice = repo.lockInvoice(request.invoiceId())
                .orElseThrow(() -> status(HttpStatus.NOT_FOUND,"Không tìm thấy hóa đơn."));
        if (!"posted".equals(invoice.state()) || !"not_paid".equals(invoice.paymentState()) || repo.paymentExists(invoice.id()))
            throw status(HttpStatus.CONFLICT,"Chỉ thanh toán một lần cho hóa đơn đã ghi sổ và chưa thanh toán.");
        if (invoice.partnerId() == null || invoice.name() == null || invoice.total() == null || invoice.total().signum() <= 0)
            throw status(HttpStatus.BAD_REQUEST,"Hóa đơn phải có đối tác, số chứng từ và tổng tiền lớn hơn 0.");
        boolean inbound = "out_invoice".equals(invoice.type());
        String debtCode = inbound ? "131" : "331";
        List<PaymentRepository.DebtItem> items = repo.debtItems(invoice.id(),debtCode);
        if (items.size() != 1) throw status(HttpStatus.CONFLICT,"Hóa đơn phải có một dòng công nợ " + debtCode + " hợp lệ.");
        PaymentRepository.DebtItem debt = items.get(0);
        if (debt.reconciled() || (inbound ? debt.debit() : debt.credit()).compareTo(invoice.total()) != 0
                || (inbound ? debt.credit() : debt.debit()).signum() != 0)
            throw status(HttpStatus.CONFLICT,"Dòng công nợ không khớp số tiền hóa đơn hoặc đã đối soát.");
        PaymentRepository.CashJournal cash = repo.cashJournal().orElseThrow(() -> status(HttpStatus.BAD_REQUEST,"Chưa cấu hình sổ tiền mặt CSH."));
        if (cash.accountId() == null || !"111".equals(cash.accountCode()) || cash.accountId() == debt.accountId())
            throw status(HttpStatus.BAD_REQUEST,"Sổ CSH phải có tài khoản mặc định 111 (Tiền mặt).");
        String name = repo.nextName(cash.id(),request.paymentDate().getYear());
        int entryId = repo.createEntry(name,cash.id(),invoice.partnerId(),actor.id(),request.paymentDate());
        BigDecimal zero = BigDecimal.ZERO, amount = invoice.total();
        repo.item(entryId,cash.accountId(),(inbound ? "Thu tiền " : "Chi tiền ") + invoice.name(),"cash",
                inbound ? amount : zero,inbound ? zero : amount,false);
        repo.item(entryId,debt.accountId(),"Tất toán " + invoice.name(),"payment_term",
                inbound ? zero : amount,inbound ? amount : zero,true);
        int paymentId = repo.createPayment(entryId,invoice.id(),inbound ? "inbound" : "outbound",amount,request.paymentDate());
        repo.reconcile(debt.id());
        repo.markPaid(invoice.id());
        return repo.find(paymentId).orElseThrow();
    }
    private ResponseStatusException status(HttpStatus status, String message) { return new ResponseStatusException(status,message); }
}
