package com.zeitplan.backend.dto;

import java.util.List;

public record KindleDevicesResponse(
        List<KindleDeviceResponse> devices
) {
}
