package com.zeitplan.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TaskTypeRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 80) String iconKey,
        @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String colorHex,
        @Size(max = 500) String description
) {
}
