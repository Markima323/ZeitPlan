package com.zeitplan.backend.dto;

import java.util.List;

public record TaskTypeResponse(
        Long id,
        String name,
        String iconKey,
        String colorHex,
        String description,
        boolean focusTask,
        int sortOrder,
        List<String> keywords
) {
}
