package com.zeitplan.backend.controller;

import com.zeitplan.backend.dto.KindleCreateDeviceRequest;
import com.zeitplan.backend.dto.KindleCreateDeviceResponse;
import com.zeitplan.backend.dto.KindleDevicesResponse;
import com.zeitplan.backend.dto.KindleEventResponse;
import com.zeitplan.backend.dto.KindleRepushResponse;
import com.zeitplan.backend.service.KindlePushService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.context.request.async.DeferredResult;

@RestController
public class KindleController {

    private final KindlePushService kindlePushService;

    public KindleController(KindlePushService kindlePushService) {
        this.kindlePushService = kindlePushService;
    }

    @GetMapping("/api/kindle/events")
    public DeferredResult<ResponseEntity<KindleEventResponse>> getEvents(
            @RequestParam(name = "since", defaultValue = "0") int since,
            @RequestHeader(name = "access-token", required = false) String accessToken,
            @RequestHeader(name = "width", required = false) Integer width,
            @RequestHeader(name = "height", required = false) Integer height,
            @RequestHeader(name = "battery-percentage", required = false) Integer batteryPercentage,
            @RequestHeader(name = "rssi", required = false) String rssi,
            @RequestHeader(name = "id", required = false) String deviceIdentifier,
            @RequestHeader(name = "model", required = false) String model,
            @RequestHeader(name = "fw-version", required = false) String fwVersion,
            HttpServletRequest request
    ) {
        return kindlePushService.pollEvents(
                accessToken,
                since,
                new KindlePushService.KindleTelemetry(
                        width,
                        height,
                        batteryPercentage,
                        rssi,
                        deviceIdentifier,
                        model,
                        fwVersion
                ),
                request
        );
    }

    @GetMapping({"/kindle/screens/{screenId}.png", "/api/kindle/screens/{screenId}.png"})
    public ResponseEntity<byte[]> getScreenImage(
            @PathVariable String screenId,
            @RequestParam("device") String deviceId,
            @RequestParam("v") int version,
            @RequestParam("w") int width,
            @RequestParam("h") int height,
            @RequestParam("expires") long expires,
            @RequestParam("sig") String signature
    ) {
        return kindlePushService.getScreenImage(screenId, deviceId, version, width, height, expires, signature);
    }

    @GetMapping("/api/kindle/devices")
    public KindleDevicesResponse getDevices() {
        return kindlePushService.getDevices();
    }

    @PostMapping("/api/kindle/devices")
    public KindleCreateDeviceResponse createDevice(@Valid @RequestBody KindleCreateDeviceRequest request) {
        return kindlePushService.createDevice(request);
    }

    @PostMapping("/api/kindle/devices/{deviceId}/repush-today-plan")
    public KindleRepushResponse repushTodayPlan(@PathVariable String deviceId) {
        return kindlePushService.repushTodayPlan(deviceId);
    }
}
