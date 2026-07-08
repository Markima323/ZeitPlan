package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.KindleCreateDeviceRequest;
import com.zeitplan.backend.dto.KindleCreateDeviceResponse;
import com.zeitplan.backend.dto.KindleDeviceResponse;
import com.zeitplan.backend.dto.KindleDevicesResponse;
import com.zeitplan.backend.dto.KindleEventResponse;
import com.zeitplan.backend.dto.KindleRepushResponse;
import com.zeitplan.backend.entity.KindleDeviceEntity;
import com.zeitplan.backend.entity.KindlePushEventEntity;
import com.zeitplan.backend.entity.KindleScreenEntity;
import com.zeitplan.backend.repository.KindleDeviceRepository;
import com.zeitplan.backend.repository.KindlePushEventRepository;
import com.zeitplan.backend.repository.KindleScreenRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.context.request.async.DeferredResult;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class KindlePushService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KindlePushService.class);
    private static final String OWNER_USER_ID = "single-user";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String SOURCE_TYPE_TODAY_CURRENT = "today_plan_current";
    private static final int DEFAULT_WIDTH = 1072;
    private static final int DEFAULT_HEIGHT = 1448;
    private static final long EVENT_TIMEOUT_MILLIS = 55_000L;
    private static final long IMAGE_URL_TTL_SECONDS = 10 * 60L;

    private final KindleDeviceRepository kindleDeviceRepository;
    private final KindleScreenRepository kindleScreenRepository;
    private final KindlePushEventRepository kindlePushEventRepository;
    private final KindleTodaySnapshotService kindleTodaySnapshotService;
    private final KindleScreenRenderer kindleScreenRenderer;
    private final KindlePushChannelManager kindlePushChannelManager;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, String> lastSnapshotFingerprintByOwner = new ConcurrentHashMap<>();
    private final Clock clock;
    private final ZoneId zoneId;
    private final String signingSecret;
    private final String publicBaseUrl;

    public KindlePushService(
            KindleDeviceRepository kindleDeviceRepository,
            KindleScreenRepository kindleScreenRepository,
            KindlePushEventRepository kindlePushEventRepository,
            KindleTodaySnapshotService kindleTodaySnapshotService,
            KindleScreenRenderer kindleScreenRenderer,
            KindlePushChannelManager kindlePushChannelManager,
            Clock clock,
            @Value("${app.kindle.signing-secret:}") String signingSecret,
            @Value("${app.auth.cookie-secret}") String authCookieSecret,
            @Value("${app.kindle.zone:Europe/Berlin}") String zoneId,
            @Value("${app.public-base-url:}") String publicBaseUrl
    ) {
        this.kindleDeviceRepository = kindleDeviceRepository;
        this.kindleScreenRepository = kindleScreenRepository;
        this.kindlePushEventRepository = kindlePushEventRepository;
        this.kindleTodaySnapshotService = kindleTodaySnapshotService;
        this.kindleScreenRenderer = kindleScreenRenderer;
        this.kindlePushChannelManager = kindlePushChannelManager;
        this.clock = clock;
        this.zoneId = resolveZoneId(zoneId);
        this.signingSecret = signingSecret == null || signingSecret.isBlank() ? authCookieSecret : signingSecret;
        this.publicBaseUrl = publicBaseUrl == null ? "" : publicBaseUrl.trim();
    }

    public KindleDevicesResponse getDevices() {
        List<KindleDeviceResponse> devices = kindleDeviceRepository.findAllByOwnerUserIdOrderByCreatedAtAsc(OWNER_USER_ID)
                .stream()
                .map(this::toDeviceResponse)
                .toList();
        return new KindleDevicesResponse(devices);
    }

    public KindleCreateDeviceResponse createDevice(KindleCreateDeviceRequest request) {
        String token = "knd_" + randomUrlToken(32);

        KindleDeviceEntity device = new KindleDeviceEntity();
        device.setId("knd_" + randomUrlToken(12));
        device.setOwnerUserId(OWNER_USER_ID);
        device.setName(request.name().trim());
        device.setDeviceTokenHash(hashToken(token));
        device.setCurrentVersion(0);
        device.setEnabled(true);

        KindleDeviceEntity savedDevice = kindleDeviceRepository.save(device);
        renderAndPublish(savedDevice, kindleTodaySnapshotService.getCurrentSnapshot(), "device_registered");
        KindleDeviceEntity refreshedDevice = kindleDeviceRepository.findById(savedDevice.getId()).orElse(savedDevice);

        return new KindleCreateDeviceResponse(toDeviceResponse(refreshedDevice), token);
    }

    public DeferredResult<ResponseEntity<KindleEventResponse>> pollEvents(
            String accessToken,
            int since,
            KindleTelemetry telemetry,
            HttpServletRequest request
    ) {
        DeferredResult<ResponseEntity<KindleEventResponse>> result = new DeferredResult<>(EVENT_TIMEOUT_MILLIS);

        Optional<KindleDeviceEntity> authenticatedDevice = authenticateDevice(accessToken);
        if (authenticatedDevice.isEmpty()) {
            result.setResult(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
            return result;
        }

        KindleDeviceEntity device = authenticatedDevice.get();
        if (!device.isEnabled()) {
            result.setResult(ResponseEntity.status(HttpStatus.FORBIDDEN).build());
            return result;
        }

        updateTelemetry(device, telemetry, request);
        KindleDeviceEntity savedDevice = kindleDeviceRepository.save(device);
        String baseUrl = resolveBaseUrl(request);

        if (savedDevice.getCurrentVersion() > since) {
            result.setResult(buildUpdateResponse(savedDevice.getId(), baseUrl));
            return result;
        }

        kindlePushChannelManager.register(
                savedDevice.getId(),
                result,
                () -> buildUpdateResponse(savedDevice.getId(), baseUrl)
        );
        return result;
    }

    public ResponseEntity<byte[]> getScreenImage(
            String screenId,
            String deviceId,
            int version,
            int width,
            int height,
            long expires,
            String signature
    ) {
        if (OffsetDateTime.now(clock.withZone(ZoneOffset.UTC)).toEpochSecond() > expires) {
            throw new ApiException(HttpStatus.GONE, "Kindle 图片链接已过期");
        }

        String expectedSignature = signImageUrl(screenId, deviceId, version, width, height, expires);
        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.UTF_8),
                (signature == null ? "" : signature).getBytes(StandardCharsets.UTF_8)
        )) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Kindle 图片签名无效");
        }

        KindleScreenEntity screen = kindleScreenRepository.findById(screenId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Kindle 图片不存在"));

        if (
                !screen.getDeviceId().equals(deviceId) ||
                screen.getVersion() != version ||
                screen.getImageWidth() != width ||
                screen.getImageHeight() != height
        ) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Kindle 图片参数无效");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(screen.getImageBytes());
    }

    public KindleRepushResponse pullCurrentScreen(
            String accessToken,
            KindleTelemetry telemetry,
            HttpServletRequest request
    ) {
        KindleDeviceEntity device = authenticateDevice(accessToken)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Kindle 设备认证失败"));

        if (!device.isEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Kindle 设备已禁用");
        }

        updateTelemetry(device, telemetry, request);
        KindleDeviceEntity savedDevice = kindleDeviceRepository.save(device);
        KindleTodaySnapshot snapshot = kindleTodaySnapshotService.getCurrentSnapshot();
        int version = renderAndPublish(savedDevice, snapshot, "device_pull");
        lastSnapshotFingerprintByOwner.put(OWNER_USER_ID, snapshot.fingerprint());
        return new KindleRepushResponse(true, version, "queued");
    }

    public KindleRepushResponse repushTodayPlan(String deviceId) {
        KindleDeviceEntity device = kindleDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Kindle 设备不存在"));

        if (!OWNER_USER_ID.equals(device.getOwnerUserId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Kindle 设备不存在");
        }

        if (!device.isEnabled()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Kindle 设备已禁用");
        }

        KindleTodaySnapshot snapshot = kindleTodaySnapshotService.getCurrentSnapshot();
        int version = renderAndPublish(device, snapshot, "manual_repush");
        lastSnapshotFingerprintByOwner.put(OWNER_USER_ID, snapshot.fingerprint());
        return new KindleRepushResponse(true, version, "queued");
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTodayPlanChanged(TodayPlanChangedEvent event) {
        LocalDate today = LocalDate.now(clock.withZone(zoneId));
        if (!today.equals(event.planDate())) {
            return;
        }

        pushCurrentSnapshotIfChanged(event.changeReason());
    }

    @Scheduled(
            initialDelayString = "${app.kindle.current-check-initial-delay-ms:5000}",
            fixedDelayString = "${app.kindle.current-check-delay-ms:30000}"
    )
    public void checkCurrentPlanSwitch() {
        pushCurrentSnapshotIfChanged("scheduled_check");
    }

    private void pushCurrentSnapshotIfChanged(String changeReason) {
        List<KindleDeviceEntity> devices = kindleDeviceRepository.findAllByOwnerUserIdAndEnabledTrueOrderByCreatedAtAsc(OWNER_USER_ID);
        if (devices.isEmpty()) {
            return;
        }

        KindleTodaySnapshot snapshot = kindleTodaySnapshotService.getCurrentSnapshot();
        String fingerprint = snapshot.fingerprint();
        String previousFingerprint = lastSnapshotFingerprintByOwner.put(OWNER_USER_ID, fingerprint);
        if (fingerprint.equals(previousFingerprint)) {
            return;
        }

        for (KindleDeviceEntity device : devices) {
            renderAndPublish(device, snapshot, changeReason);
        }
    }

    private int renderAndPublish(KindleDeviceEntity device, KindleTodaySnapshot snapshot, String changeReason) {
        int width = sanitizeDimension(device.getLastWidth(), DEFAULT_WIDTH);
        int height = sanitizeDimension(device.getLastHeight(), DEFAULT_HEIGHT);
        int version = device.getCurrentVersion() + 1;
        String screenId = "scr_" + randomUrlToken(14);

        KindlePushEventEntity pushEvent = new KindlePushEventEntity();
        pushEvent.setId("evt_" + randomUrlToken(14));
        pushEvent.setDeviceId(device.getId());
        pushEvent.setOwnerUserId(device.getOwnerUserId());
        pushEvent.setEventType("today_plan.current_changed");
        pushEvent.setVersion(version);
        pushEvent.setStatus("rendering");
        kindlePushEventRepository.save(pushEvent);

        try {
            byte[] imageBytes = kindleScreenRenderer.render(snapshot, width, height);

            KindleScreenEntity screen = new KindleScreenEntity();
            screen.setId(screenId);
            screen.setDeviceId(device.getId());
            screen.setOwnerUserId(device.getOwnerUserId());
            screen.setSourceType(SOURCE_TYPE_TODAY_CURRENT);
            screen.setSourceRef(snapshot.sourceRef());
            screen.setTitle(snapshot.hasCurrentItem() ? snapshot.title() : "暂无进行中的任务");
            screen.setVersion(version);
            screen.setImagePath("database:" + screenId);
            screen.setImageBytes(imageBytes);
            screen.setImageWidth(width);
            screen.setImageHeight(height);
            screen.setRenderStatus("ready");
            screen.setRenderedAt(OffsetDateTime.now(clock.withZone(ZoneOffset.UTC)));
            screen.setExpiresAt(OffsetDateTime.now(clock.withZone(ZoneOffset.UTC)).plusDays(7));
            kindleScreenRepository.save(screen);

            device.setCurrentScreenId(screen.getId());
            device.setCurrentVersion(version);
            kindleDeviceRepository.save(device);

            pushEvent.setScreenId(screen.getId());
            pushEvent.setStatus("ready");
            kindlePushEventRepository.save(pushEvent);
            kindlePushChannelManager.notifyDevice(device.getId());
            return version;
        } catch (RuntimeException exception) {
            LOGGER.warn("Kindle screen render failed for device {} after {}", device.getId(), changeReason, exception);
            pushEvent.setStatus("failed");
            pushEvent.setErrorMessage(exception.getMessage());
            kindlePushEventRepository.save(pushEvent);
            return device.getCurrentVersion();
        }
    }

    private KindleDeviceResponse toDeviceResponse(KindleDeviceEntity device) {
        KindleScreenEntity screen = device.getCurrentScreenId() == null
                ? null
                : kindleScreenRepository.findById(device.getCurrentScreenId()).orElse(null);

        return new KindleDeviceResponse(
                device.getId(),
                device.getName(),
                device.getLastSeenAt(),
                device.getLastWidth(),
                device.getLastHeight(),
                device.getLastBatteryPercentage(),
                device.getLastRssi(),
                device.getCurrentVersion(),
                screen == null ? null : screen.getTitle(),
                screen == null ? null : screen.getRenderStatus(),
                screen == null ? null : screen.getErrorMessage(),
                screen == null ? null : screen.getRenderedAt(),
                device.isEnabled()
        );
    }

    private ResponseEntity<KindleEventResponse> buildUpdateResponse(String deviceId, String baseUrl) {
        KindleDeviceEntity device = kindleDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Kindle 设备不存在"));

        if (device.getCurrentScreenId() == null || device.getCurrentVersion() <= 0) {
            return ResponseEntity.noContent().build();
        }

        KindleScreenEntity screen = kindleScreenRepository.findById(device.getCurrentScreenId())
                .orElse(null);
        if (screen == null) {
            return ResponseEntity.noContent().build();
        }

        long expires = OffsetDateTime.now(clock.withZone(ZoneOffset.UTC)).plusSeconds(IMAGE_URL_TTL_SECONDS).toEpochSecond();
        String imageUrl = buildImageUrl(baseUrl, screen, expires);
        return ResponseEntity.ok(new KindleEventResponse(
                "screen.update",
                device.getCurrentVersion(),
                imageUrl,
                screen.getImageWidth(),
                screen.getImageHeight(),
                screen.getRenderedAt()
        ));
    }

    private String buildImageUrl(String baseUrl, KindleScreenEntity screen, long expires) {
        int width = screen.getImageWidth();
        int height = screen.getImageHeight();
        String signature = signImageUrl(screen.getId(), screen.getDeviceId(), screen.getVersion(), width, height, expires);
        return baseUrl
                + "/api/kindle/screens/" + encode(screen.getId()) + ".png"
                + "?device=" + encode(screen.getDeviceId())
                + "&v=" + screen.getVersion()
                + "&w=" + width
                + "&h=" + height
                + "&expires=" + expires
                + "&sig=" + encode(signature);
    }

    private Optional<KindleDeviceEntity> authenticateDevice(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            return Optional.empty();
        }

        return kindleDeviceRepository.findByDeviceTokenHash(hashToken(accessToken.trim()));
    }

    private void updateTelemetry(KindleDeviceEntity device, KindleTelemetry telemetry, HttpServletRequest request) {
        device.setLastSeenAt(OffsetDateTime.now(clock.withZone(ZoneOffset.UTC)));
        device.setLastIp(resolveClientIp(request));
        device.setLastWidth(sanitizeDimension(telemetry.width(), DEFAULT_WIDTH));
        device.setLastHeight(sanitizeDimension(telemetry.height(), DEFAULT_HEIGHT));
        device.setLastBatteryPercentage(telemetry.batteryPercentage());
        device.setLastRssi(telemetry.rssi());
        device.setLastDeviceIdentifier(telemetry.deviceIdentifier());
        device.setLastModel(telemetry.model());
        device.setLastFwVersion(telemetry.fwVersion());
    }

    private int sanitizeDimension(Integer value, int fallback) {
        if (value == null) {
            return fallback;
        }

        return Math.max(300, Math.min(2400, value));
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",", 2)[0].trim();
        }

        return request.getRemoteAddr();
    }

    private String resolveBaseUrl(HttpServletRequest request) {
        if (!publicBaseUrl.isBlank()) {
            return publicBaseUrl.replaceAll("/+$", "");
        }

        String proto = Optional.ofNullable(request.getHeader("X-Forwarded-Proto")).orElse(request.getScheme());
        String host = Optional.ofNullable(request.getHeader("Host")).orElse(request.getServerName());
        return proto + "://" + host;
    }

    private String hashToken(String token) {
        return hmac("token:" + token);
    }

    private String signImageUrl(String screenId, String deviceId, int version, int width, int height, long expires) {
        return hmac(String.join("|",
                "screen",
                screenId,
                deviceId,
                Integer.toString(version),
                Integer.toString(width),
                Integer.toString(height),
                Long.toString(expires)
        ));
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] signature = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign Kindle value", exception);
        }
    }

    private String randomUrlToken(int bytes) {
        byte[] value = new byte[bytes];
        secureRandom.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private ZoneId resolveZoneId(String value) {
        if (value == null || value.isBlank()) {
            return ZoneId.of("Europe/Berlin");
        }

        return ZoneId.of(value.trim());
    }

    public record KindleTelemetry(
            Integer width,
            Integer height,
            Integer batteryPercentage,
            String rssi,
            String deviceIdentifier,
            String model,
            String fwVersion
    ) {
    }
}
