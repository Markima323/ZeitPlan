package com.zeitplan.backend.dto;

import java.time.LocalDate;
import java.util.List;

public record AdminOverviewResponse(
        LocalDate fromDate,
        LocalDate toDate,
        int plannedDays,
        int focusMinutes,
        List<DailyPlanSummaryResponse> days,
        List<TaskTypeStatResponse> typeStats
) {
}
