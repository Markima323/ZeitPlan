package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.AuthSessionResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;

@Service
public class AuthSessionService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final String password;
    private final String cookieName;
    private final String cookieSecret;
    private final int cookieDurationDays;
    private final boolean secureCookie;

    public AuthSessionService(
            @Value("${app.auth.password}") String password,
            @Value("${app.auth.cookie-name}") String cookieName,
            @Value("${app.auth.cookie-secret}") String cookieSecret,
            @Value("${app.auth.cookie-duration-days}") int cookieDurationDays,
            @Value("${app.auth.secure-cookie}") boolean secureCookie
    ) {
        this.password = password;
        this.cookieName = cookieName;
        this.cookieSecret = cookieSecret;
        this.cookieDurationDays = cookieDurationDays;
        this.secureCookie = secureCookie;
    }

    public AuthSessionResponse createSession(String submittedPassword) {
        if (!password.equals(submittedPassword == null ? "" : submittedPassword)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "密码不正确");
        }

        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(cookieDurationDays);
        return new AuthSessionResponse(true, expiresAt, cookieDurationDays);
    }

    public AuthSessionResponse getActiveSession(HttpServletRequest request) {
        OffsetDateTime expiresAt = resolveSessionExpiry(request);
        if (expiresAt == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "请先登录");
        }

        return new AuthSessionResponse(true, expiresAt, cookieDurationDays);
    }

    public boolean isAuthenticated(HttpServletRequest request) {
        return resolveSessionExpiry(request) != null;
    }

    public ResponseCookie buildSessionCookie(OffsetDateTime expiresAt) {
        long expiresAtEpochSeconds = expiresAt.toEpochSecond();
        String value = expiresAtEpochSeconds + "." + sign(expiresAtEpochSeconds);

        return ResponseCookie.from(cookieName, value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/")
                .maxAge(cookieDurationDays * 24L * 60L * 60L)
                .build();
    }

    public ResponseCookie buildClearedSessionCookie() {
        return ResponseCookie.from(cookieName, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    private OffsetDateTime resolveSessionExpiry(HttpServletRequest request) {
        String rawCookieValue = readCookieValue(request);
        if (rawCookieValue == null || rawCookieValue.isBlank()) {
            return null;
        }

        String[] parts = rawCookieValue.split("\\.", 2);
        if (parts.length != 2) {
            return null;
        }

        long expiresAtEpochSeconds;
        try {
            expiresAtEpochSeconds = Long.parseLong(parts[0]);
        } catch (NumberFormatException ignored) {
            return null;
        }

        if (!MessageDigest.isEqual(
                sign(expiresAtEpochSeconds).getBytes(StandardCharsets.UTF_8),
                parts[1].getBytes(StandardCharsets.UTF_8)
        )) {
            return null;
        }

        OffsetDateTime expiresAt = OffsetDateTime.ofInstant(Instant.ofEpochSecond(expiresAtEpochSeconds), ZoneOffset.UTC);
        if (expiresAt.isBefore(OffsetDateTime.now(ZoneOffset.UTC))) {
            return null;
        }

        return expiresAt;
    }

    private String readCookieValue(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }

        return null;
    }

    private String sign(long expiresAtEpochSeconds) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            String secret = cookieSecret + ":" + password;
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] signature = mac.doFinal(Long.toString(expiresAtEpochSeconds).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign auth cookie", exception);
        }
    }
}
