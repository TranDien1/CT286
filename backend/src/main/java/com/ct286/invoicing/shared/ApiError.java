package com.ct286.invoicing.shared;

import java.time.Instant;

public record ApiError(Instant timestamp, int status, String code, String message) {
}
