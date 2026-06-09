package com.zeitplan.backend.dto;

import com.zeitplan.backend.entity.DicePhase;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record DiceRollResponse(
        Long id,
        LocalDate planDate,
        DicePhase phase,
        int value,
        boolean rewardUnlocked,
        String message,
        OffsetDateTime createdAt
) {
}
