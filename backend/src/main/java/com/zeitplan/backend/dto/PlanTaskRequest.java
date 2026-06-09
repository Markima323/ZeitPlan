package com.zeitplan.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record PlanTaskRequest(
        Long id,
        @Size(max = 240) String title,
        Long taskTypeId,
        @Min(10) @Max(1440) Integer durationMinutes,
        Integer orderIndex
) {
}
