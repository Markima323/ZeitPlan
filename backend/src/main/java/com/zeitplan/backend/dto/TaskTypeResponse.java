package com.zeitplan.backend.dto;

public record TaskTypeResponse(
        Long id,
        String name,
        String iconKey,
        String colorHex,
        String description,
        boolean focusTask,
        int sortOrder
) {
}
