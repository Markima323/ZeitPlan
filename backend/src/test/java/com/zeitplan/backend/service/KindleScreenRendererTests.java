package com.zeitplan.backend.service;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class KindleScreenRendererTests {

    private final KindleScreenRenderer renderer = new KindleScreenRenderer();

    @Test
    void renderUsesEipsFriendlyGrayscalePng() {
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
        assertThat(header.bitDepth()).isEqualTo(8);
        assertThat(header.colorType()).isEqualTo(0);
    }

    @Test
    void wrapPngAsPdfKeepsKindleScreenAspectRatio() {
        KindleTodaySnapshot snapshot = new KindleTodaySnapshot(
                LocalDate.of(2026, 7, 8),
                "task-1",
                "Kindle \u9875\u9762\u6d4b\u8bd5",
                "\u6df1\u5ea6\u5de5\u4f5c",
                LocalTime.of(16, 5),
                LocalTime.of(16, 30),
                "\u4e0b\u4e00\u9879",
                OffsetDateTime.parse("2026-07-08T16:05:00+02:00")
        );

        byte[] png = renderer.render(snapshot, 1072, 1448);
        byte[] pdf = renderer.wrapPngAsPdf(png);
        String pdfText = new String(pdf, StandardCharsets.ISO_8859_1);

        assertThat(pdfText).startsWith("%PDF-1.4");
        assertThat(pdfText).contains("/Subtype /Image");
        assertThat(pdfText).contains("/ColorSpace /DeviceGray");
        assertThat(pdfText).contains("/MediaBox [0 0 257.28 347.52]");
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
