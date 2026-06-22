package com.zeitplan.backend.dto;

import com.zeitplan.backend.entity.SeasonMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record DailyPlanRequest(
        @NotNull LocalDate planDate,
        @NotNull SeasonMode seasonMode,
        @NotNull LocalTime dayStartLocalTime,
        @NotNull Boolean nightPlanEnabled,
        @NotNull List<@Valid PlanTaskRequest> tasks
) {
}
