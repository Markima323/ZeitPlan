package com.zeitplan.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record AuthSessionRequest(
        @NotBlank String password
) {
}
