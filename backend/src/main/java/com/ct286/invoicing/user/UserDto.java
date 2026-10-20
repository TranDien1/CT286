package com.ct286.invoicing.user;

public record UserDto(int id, String userName, String fullName, String email, String phone,
                      String role, boolean active) { }
