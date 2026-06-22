package com.zeitplan.backend.dto;

import com.zeitplan.backend.entity.SeasonMode;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record DailyPlanResponse(
        Long id,
        LocalDate planDate,
        SeasonMode seasonMode,
        LocalTime dayStartLocalTime,
        boolean nightPlanEnabled,
        List<PlanTaskResponse> tasks
) {
}
