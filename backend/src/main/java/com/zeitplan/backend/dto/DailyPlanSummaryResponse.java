package com.zeitplan.backend.dto;

import com.zeitplan.backend.entity.SeasonMode;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record DailyPlanSummaryResponse(
        LocalDate planDate,
        SeasonMode seasonMode,
        int taskCount,
        int focusMinutes,
        int breakMinutes,
        LocalTime firstLocalStartTime,
        LocalTime lastLocalEndTime,
        List<String> highlightTasks
) {
}
