package com.zeitplan.backend.dto;

import java.time.OffsetDateTime;

public record KindleDeviceResponse(
        String id,
        String name,
        OffsetDateTime lastSeenAt,
        Integer lastWidth,
        Integer lastHeight,
        Integer lastBatteryPercentage,
        String lastRssi,
        Integer currentVersion,
        String currentScreenTitle,
        String lastRenderStatus,
        String lastErrorMessage,
        OffsetDateTime lastPushedAt,
        boolean enabled
) {
}
