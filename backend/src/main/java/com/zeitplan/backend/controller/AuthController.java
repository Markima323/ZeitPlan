package com.zeitplan.backend.controller;

import com.zeitplan.backend.dto.AuthSessionRequest;
import com.zeitplan.backend.dto.AuthSessionResponse;
import com.zeitplan.backend.service.AuthSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthSessionService authSessionService;

    public AuthController(AuthSessionService authSessionService) {
        this.authSessionService = authSessionService;
    }

    @GetMapping("/session")
    public AuthSessionResponse getSession(HttpServletRequest request) {
        return authSessionService.getActiveSession(request);
    }

    @PostMapping("/session")
    public ResponseEntity<AuthSessionResponse> login(@Valid @RequestBody AuthSessionRequest request) {
        AuthSessionResponse session = authSessionService.createSession(request.password());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, authSessionService.buildSessionCookie(session.expiresAt()).toString())
                .body(session);
    }

    @DeleteMapping("/session")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authSessionService.buildClearedSessionCookie().toString())
                .build();
    }
}
