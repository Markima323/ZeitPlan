package com.zeitplan.backend.dto;

public record KindleCreateDeviceResponse(
        KindleDeviceResponse device,
        String deviceToken
) {
}
