package com.zeitplan.backend.dto;

import java.time.OffsetDateTime;

public record AuthSessionResponse(
        boolean authenticated,
        OffsetDateTime expiresAt,
        int cookieDurationDays
) {
}
