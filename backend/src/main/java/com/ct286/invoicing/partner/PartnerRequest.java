package com.ct286.invoicing.partner;

public record PartnerRequest(String name, String partnerType, String vat, String email,
                             String phone, String address, String city) { }
