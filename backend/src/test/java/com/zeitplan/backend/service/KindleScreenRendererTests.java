package com.zeitplan.backend.service;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class KindleScreenRendererTests {

    private final KindleScreenRenderer renderer = new KindleScreenRenderer();

    @Test
    void renderUsesEipsFriendlyIndexedPng() {
        KindleTodaySnapshot snapshot = new KindleTodaySnapshot(
                LocalDate.of(2026, 7, 8),
                "task-1",
                "方法整理",
                "深度工作",
                LocalTime.of(16, 5),
                LocalTime.of(16, 30),
                "收拾衣服",
                OffsetDateTime.parse("2026-07-08T16:05:00+02:00")
        );

        byte[] png = renderer.render(snapshot, 536, 724);
        PngHeader header = readPngHeader(png);

        assertThat(header.width()).isEqualTo(536);
        assertThat(header.height()).isEqualTo(724);
        assertThat(header.bitDepth()).isEqualTo(4);
        assertThat(header.colorType()).isEqualTo(0);
    }

    private PngHeader readPngHeader(byte[] png) {
        assertThat(png).startsWith(new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        });
        assertThat(new String(png, 12, 4)).isEqualTo("IHDR");

        ByteBuffer ihdr = ByteBuffer.wrap(png, 16, 13);
        return new PngHeader(
                ihdr.getInt(),
                ihdr.getInt(),
                Byte.toUnsignedInt(ihdr.get()),
                Byte.toUnsignedInt(ihdr.get())
        );
    }

    private record PngHeader(int width, int height, int bitDepth, int colorType) {
    }
}
