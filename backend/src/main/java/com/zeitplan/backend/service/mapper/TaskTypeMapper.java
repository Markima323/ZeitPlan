package com.zeitplan.backend.service.mapper;

import com.zeitplan.backend.dto.TaskTypeResponse;
import com.zeitplan.backend.entity.TaskTypeEntity;

public final class TaskTypeMapper {

    private TaskTypeMapper() {
    }

    public static TaskTypeResponse toResponse(TaskTypeEntity entity) {
        return new TaskTypeResponse(
                entity.getId(),
                entity.getName(),
                entity.getIconKey(),
                entity.getColorHex(),
                entity.getDescription()
        );
    }
}
