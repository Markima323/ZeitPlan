package com.zeitplan.backend.dto;

public record PlanTaskResponse(
        Long id,
        String title,
        Long taskTypeId,
        Integer durationMinutes,
        Integer orderIndex,
        boolean taskTypeAutoLocked
) {
}
