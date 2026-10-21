package com.ct286.invoicing.partner;

public record PartnerDto(int id, String name, String partnerType, String vat, String email,
                         String phone, String address, String city, boolean active, boolean usedInTransactions) { }
