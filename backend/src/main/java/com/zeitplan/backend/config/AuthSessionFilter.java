package com.zeitplan.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeitplan.backend.dto.ErrorResponse;
import com.zeitplan.backend.service.AuthSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;

@Component
public class AuthSessionFilter extends OncePerRequestFilter {

    private final AuthSessionService authSessionService;
    private final ObjectMapper objectMapper;

    public AuthSessionFilter(AuthSessionService authSessionService, ObjectMapper objectMapper) {
        this.authSessionService = authSessionService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        return !path.startsWith("/api/")
                || path.startsWith("/api/auth/")
                || path.equals("/api/kindle/events")
                || path.startsWith("/api/kindle/screens/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (authSessionService.isAuthenticated(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), new ErrorResponse("请先登录", OffsetDateTime.now()));
    }
}
