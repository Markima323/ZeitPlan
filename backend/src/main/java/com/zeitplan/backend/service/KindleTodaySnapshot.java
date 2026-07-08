package com.zeitplan.backend.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

public record KindleTodaySnapshot(
        LocalDate planDate,
        String currentItemId,
        String title,
        String taskTypeName,
        LocalTime startTime,
        LocalTime endTime,
        String nextTitle,
        OffsetDateTime generatedAt
) {

    public boolean hasCurrentItem() {
        return currentItemId != null;
    }

    public String fingerprint() {
        return String.join("|",
                planDate.toString(),
                currentItemId == null ? "empty" : currentItemId,
                title == null ? "" : title,
                taskTypeName == null ? "" : taskTypeName,
                startTime == null ? "" : startTime.toString(),
                endTime == null ? "" : endTime.toString(),
                nextTitle == null ? "" : nextTitle
        );
    }

    public String sourceRef() {
        return planDate + ":" + (currentItemId == null ? "empty" : currentItemId);
    }
}
