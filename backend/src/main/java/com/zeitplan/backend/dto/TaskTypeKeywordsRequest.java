package com.zeitplan.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TaskTypeKeywordsRequest(
        @NotNull @Size(max = 100) List<@NotBlank @Size(max = 120) String> keywords
) {
}
