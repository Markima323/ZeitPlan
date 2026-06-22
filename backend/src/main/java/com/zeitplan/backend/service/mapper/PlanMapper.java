package com.zeitplan.backend.service.mapper;

import com.zeitplan.backend.dto.DailyPlanResponse;
import com.zeitplan.backend.dto.DiceRollResponse;
import com.zeitplan.backend.dto.PlanTaskResponse;
import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.DiceRollEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;

import java.util.Comparator;
import java.util.List;

public final class PlanMapper {

    private PlanMapper() {
    }

    public static DailyPlanResponse toResponse(DailyPlanEntity entity) {
        List<PlanTaskResponse> tasks = entity.getTasks()
                .stream()
                .sorted(Comparator.comparing(PlanTaskEntity::getOrderIndex))
                .map(PlanMapper::toTaskResponse)
                .toList();

        return new DailyPlanResponse(
                entity.getId(),
                entity.getPlanDate(),
                entity.getSeasonMode(),
                entity.getDayStartLocalTime(),
                entity.isNightPlanEnabled(),
                tasks
        );
    }

    public static PlanTaskResponse toTaskResponse(PlanTaskEntity entity) {
        return new PlanTaskResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getTaskType() != null ? entity.getTaskType().getId() : null,
                entity.getDurationMinutes(),
                entity.getOrderIndex()
        );
    }

    public static DiceRollResponse toDiceResponse(DiceRollEntity entity) {
        return new DiceRollResponse(
                entity.getId(),
                entity.getPlan().getPlanDate(),
                entity.getPhase(),
                entity.getValue(),
                entity.getRewardUnlocked(),
                entity.getMessage(),
                entity.getCreatedAt()
        );
    }
}
