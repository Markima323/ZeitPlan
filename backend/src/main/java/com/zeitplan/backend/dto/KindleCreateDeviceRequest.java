package com.zeitplan.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record KindleCreateDeviceRequest(
        @NotBlank @Size(max = 120) String name
) {
}
