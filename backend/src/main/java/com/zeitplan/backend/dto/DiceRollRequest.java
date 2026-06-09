package com.zeitplan.backend.dto;

import com.zeitplan.backend.entity.DicePhase;
import jakarta.validation.constraints.NotNull;

public record DiceRollRequest(
        @NotNull DicePhase phase
) {
}
