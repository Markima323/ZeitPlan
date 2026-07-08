package com.zeitplan.backend.dto;

public record KindleRepushResponse(
        boolean ok,
        int version,
        String status
) {
}
