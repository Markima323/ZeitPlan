package com.zeitplan.backend.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record TaskTypeOrderRequest(
        @NotEmpty List<@NotNull Long> taskTypeIds
) {
}
