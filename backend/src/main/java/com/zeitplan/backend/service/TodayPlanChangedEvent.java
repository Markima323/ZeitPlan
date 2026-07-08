package com.zeitplan.backend.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record TodayPlanChangedEvent(
        LocalDate planDate,
        String changeReason,
        OffsetDateTime changedAt
) {
}
