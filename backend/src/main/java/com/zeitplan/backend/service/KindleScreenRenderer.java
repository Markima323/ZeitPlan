package com.zeitplan.backend.service;

import org.springframework.stereotype.Service;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.zip.CRC32;
import java.util.zip.DeflaterOutputStream;

@Service
public class KindleScreenRenderer {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    public byte[] render(KindleTodaySnapshot snapshot, int width, int height) {
        // Some Kindle firmware builds reject Java's grayscale PNG output in eips.
        // RGB keeps the image monochrome visually while using a broadly supported PNG type.
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);

            int margin = Math.max(34, Math.round(width * 0.06f));
            int contentWidth = width - (margin * 2);
            int cursorY = margin;

            Font eyebrowFont = font(Font.BOLD, Math.max(22, width / 34));
            Font titleFont = font(Font.BOLD, Math.max(50, width / 16));
            Font sectionFont = font(Font.BOLD, Math.max(30, width / 24));
            Font taskFont = font(Font.BOLD, Math.max(58, width / 14));
            Font detailFont = font(Font.PLAIN, Math.max(30, width / 26));
            Font footerFont = font(Font.PLAIN, Math.max(22, width / 34));

            graphics.setColor(Color.BLACK);
            cursorY = drawText(graphics, "\u4eca\u65e5\u8ba1\u5212", margin, cursorY, eyebrowFont, contentWidth);
            cursorY += Math.max(16, height / 90);
            cursorY = drawText(graphics, snapshot.planDate().format(DATE_FORMATTER) + "  " + weekday(snapshot), margin, cursorY, titleFont, contentWidth);
            cursorY += Math.max(34, height / 36);
            drawLine(graphics, margin, cursorY, width - margin);
            cursorY += Math.max(52, height / 24);

            if (snapshot.hasCurrentItem()) {
                cursorY = drawText(graphics, "\u5f53\u524d\u8fdb\u884c\u4e2d", margin, cursorY, sectionFont, contentWidth);
                cursorY += Math.max(30, height / 42);
                cursorY = drawWrappedText(graphics, snapshot.title(), margin, cursorY, taskFont, contentWidth, 4, 1.12f);
                cursorY += Math.max(46, height / 30);
                cursorY = drawText(graphics, "\u5f00\u59cb\u65f6\u95f4\uff1a" + snapshot.startTime().format(TIME_FORMATTER), margin, cursorY, detailFont, contentWidth);
                cursorY += Math.max(18, height / 80);
                cursorY = drawText(graphics, "\u9884\u8ba1\u7ed3\u675f\uff1a" + snapshot.endTime().format(TIME_FORMATTER), margin, cursorY, detailFont, contentWidth);

                if (snapshot.taskTypeName() != null && !snapshot.taskTypeName().isBlank()) {
                    cursorY += Math.max(18, height / 80);
                    cursorY = drawText(graphics, "\u4efb\u52a1\u7c7b\u578b\uff1a" + snapshot.taskTypeName(), margin, cursorY, detailFont, contentWidth);
                }

                if (snapshot.nextTitle() != null && !snapshot.nextTitle().isBlank()) {
                    cursorY += Math.max(42, height / 34);
                    cursorY = drawWrappedText(graphics, "\u4e0b\u4e00\u9879\uff1a" + snapshot.nextTitle(), margin, cursorY, detailFont, contentWidth, 2, 1.25f);
                }
            } else {
                cursorY = drawText(graphics, "\u6682\u65e0\u8fdb\u884c\u4e2d\u7684\u4efb\u52a1", margin, cursorY, titleFont, contentWidth);
                cursorY += Math.max(34, height / 36);
                drawWrappedText(graphics, "Kindle \u4f1a\u5728\u5f53\u524d\u4e8b\u9879\u5f00\u59cb\u6216\u5185\u5bb9\u53d8\u5316\u65f6\u81ea\u52a8\u5237\u65b0\u3002", margin, cursorY, detailFont, contentWidth, 3, 1.25f);
            }

            int footerY = height - margin - graphics.getFontMetrics(footerFont).getHeight();
            drawLine(graphics, margin, footerY - Math.max(28, height / 55), width - margin);
            graphics.setColor(new Color(80, 80, 80));
            drawText(graphics, "\u6700\u8fd1\u66f4\u65b0\uff1a" + snapshot.generatedAt().format(DateTimeFormatter.ofPattern("HH:mm")), margin, footerY, footerFont, contentWidth);
            drawUpdateHint(graphics, width, height, margin, footerFont);

            return writeEightBitGrayscalePng(image);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to render Kindle screen", exception);
        } finally {
            graphics.dispose();
        }
    }

    private byte[] writeEightBitGrayscalePng(BufferedImage source) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        DataOutputStream data = new DataOutputStream(output);
        data.write(new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        });

        ByteArrayOutputStream ihdrBytes = new ByteArrayOutputStream(13);
        DataOutputStream ihdr = new DataOutputStream(ihdrBytes);
        ihdr.writeInt(source.getWidth());
        ihdr.writeInt(source.getHeight());
        ihdr.writeByte(8);
        ihdr.writeByte(0);
        ihdr.writeByte(0);
        ihdr.writeByte(0);
        ihdr.writeByte(0);
        writePngChunk(data, "IHDR", ihdrBytes.toByteArray());

        int rowByteCount = source.getWidth();
        ByteArrayOutputStream rawImage = new ByteArrayOutputStream((rowByteCount + 1) * source.getHeight());
        byte[] row = new byte[rowByteCount];
        for (int y = 0; y < source.getHeight(); y += 1) {
            rawImage.write(0);
            for (int x = 0; x < source.getWidth(); x += 1) {
                row[x] = (byte) grayscale(source.getRGB(x, y));
            }
            rawImage.write(row);
        }

        ByteArrayOutputStream compressedImage = new ByteArrayOutputStream();
        try (DeflaterOutputStream deflater = new DeflaterOutputStream(compressedImage)) {
            rawImage.writeTo(deflater);
        }
        writePngChunk(data, "IDAT", compressedImage.toByteArray());
        writePngChunk(data, "IEND", new byte[0]);
        return output.toByteArray();
    }

    private int grayscale(int rgb) {
        int red = (rgb >> 16) & 0xff;
        int green = (rgb >> 8) & 0xff;
        int blue = rgb & 0xff;
        return ((red * 299) + (green * 587) + (blue * 114) + 500) / 1000;
    }

    private void writePngChunk(DataOutputStream output, String type, byte[] payload) throws IOException {
        byte[] typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        output.writeInt(payload.length);
        output.write(typeBytes);
        output.write(payload);

        CRC32 crc32 = new CRC32();
        crc32.update(typeBytes);
        crc32.update(payload);
        output.writeInt((int) crc32.getValue());
    }

    private String weekday(KindleTodaySnapshot snapshot) {
        return snapshot.planDate().getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.CHINA);
    }

    private Font font(int style, int size) {
        return new Font("Noto Sans CJK SC", style, size);
    }

    private int drawText(Graphics2D graphics, String text, int x, int y, Font font, int maxWidth) {
        graphics.setFont(font);
        FontMetrics metrics = graphics.getFontMetrics();
        String safeText = ellipsize(graphics, text, maxWidth);
        graphics.drawString(safeText, x, y + metrics.getAscent());
        return y + metrics.getHeight();
    }

    private int drawWrappedText(
            Graphics2D graphics,
            String text,
            int x,
            int y,
            Font font,
            int maxWidth,
            int maxLines,
            float lineHeight
    ) {
        graphics.setFont(font);
        FontMetrics metrics = graphics.getFontMetrics();
        List<String> lines = wrap(graphics, text, maxWidth, maxLines);
        int lineStep = Math.round(metrics.getHeight() * lineHeight);
        int cursorY = y;
        for (String line : lines) {
            graphics.drawString(line, x, cursorY + metrics.getAscent());
            cursorY += lineStep;
        }
        return cursorY;
    }

    private List<String> wrap(Graphics2D graphics, String text, int maxWidth, int maxLines) {
        List<String> lines = new ArrayList<>();
        String remaining = text == null || text.isBlank() ? "-" : text.trim();

        while (!remaining.isBlank() && lines.size() < maxLines) {
            int fitLength = findFitLength(graphics, remaining, maxWidth);
            if (fitLength >= remaining.length()) {
                lines.add(remaining);
                break;
            }

            String line = remaining.substring(0, Math.max(1, fitLength)).trim();
            remaining = remaining.substring(Math.max(1, fitLength)).trim();
            if (lines.size() == maxLines - 1 && !remaining.isBlank()) {
                line = ellipsize(graphics, line + remaining, maxWidth);
                lines.add(line);
                break;
            }

            lines.add(line);
        }

        if (lines.isEmpty()) {
            lines.add("-");
        }

        return lines;
    }

    private int findFitLength(Graphics2D graphics, String text, int maxWidth) {
        int low = 1;
        int high = text.length();
        int best = 1;

        while (low <= high) {
            int mid = (low + high) / 2;
            if (graphics.getFontMetrics().stringWidth(text.substring(0, mid)) <= maxWidth) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return best;
    }

    private String ellipsize(Graphics2D graphics, String text, int maxWidth) {
        if (text == null || text.isBlank()) {
            return "-";
        }

        if (graphics.getFontMetrics().stringWidth(text) <= maxWidth) {
            return text;
        }

        String suffix = "...";
        int fitLength = findFitLength(graphics, text, Math.max(1, maxWidth - graphics.getFontMetrics().stringWidth(suffix)));
        return text.substring(0, Math.max(1, fitLength)).trim() + suffix;
    }

    private void drawLine(Graphics2D graphics, int x1, int y, int x2) {
        graphics.setColor(new Color(170, 170, 170));
        graphics.setStroke(new BasicStroke(2f));
        graphics.drawLine(x1, y, x2, y);
        graphics.setColor(Color.BLACK);
    }

    private void drawUpdateHint(Graphics2D graphics, int width, int height, int margin, Font font) {
        graphics.setFont(font);
        FontMetrics metrics = graphics.getFontMetrics();
        String label = "\u66f4\u65b0";
        int paddingX = Math.max(14, width / 45);
        int paddingY = Math.max(8, height / 120);
        int buttonWidth = metrics.stringWidth(label) + (paddingX * 2);
        int buttonHeight = metrics.getHeight() + (paddingY * 2);
        int x = width - margin - buttonWidth;
        int y = height - margin - buttonHeight;

        graphics.setColor(Color.WHITE);
        graphics.fillRoundRect(x, y, buttonWidth, buttonHeight, 16, 16);
        graphics.setColor(new Color(90, 90, 90));
        graphics.setStroke(new BasicStroke(2f));
        graphics.drawRoundRect(x, y, buttonWidth, buttonHeight, 16, 16);
        graphics.setColor(Color.BLACK);
        graphics.drawString(label, x + paddingX, y + paddingY + metrics.getAscent());
    }
}
