package com.zeitplan.backend.dto;

public record TaskTypeStatResponse(
        Long taskTypeId,
        String taskTypeName,
        String taskTypeIcon,
        String taskTypeColor,
        int totalMinutes
) {
}
