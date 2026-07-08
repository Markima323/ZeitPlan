package com.zeitplan.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.OffsetDateTime;

public record KindleEventResponse(
        String type,
        int version,
        @JsonProperty("image_url") String imageUrl,
        int width,
        int height,
        @JsonProperty("created_at") OffsetDateTime createdAt
) {
}
