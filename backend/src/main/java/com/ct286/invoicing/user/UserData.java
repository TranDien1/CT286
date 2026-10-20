package com.ct286.invoicing.user;

record UserData(int id, String userName, String fullName, String email, String phone,
                String passwordHash, String role, boolean active) {
    UserDto dto() { return new UserDto(id, userName, fullName, email, phone, role, active); }
}
