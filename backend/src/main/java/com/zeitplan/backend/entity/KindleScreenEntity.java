package com.zeitplan.backend.entity;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "kindle_screens")
public class KindleScreenEntity {

    @Id
    @Column(length = 48)
    private String id;

    @Column(name = "device_id", nullable = false, length = 48)
    private String deviceId;

    @Column(name = "owner_user_id", nullable = false, length = 80)
    private String ownerUserId;

    @Column(name = "source_type", nullable = false, length = 80)
    private String sourceType;

    @Column(name = "source_ref", nullable = false, length = 160)
    private String sourceRef;

    @Column(length = 240)
    private String title;

    @Column(nullable = false)
    private int version;

    @Column(name = "image_path", nullable = false, length = 160)
    private String imagePath;

    @Column(name = "image_bytes", nullable = false)
    private byte[] imageBytes;

    @Column(name = "image_width", nullable = false)
    private int imageWidth;

    @Column(name = "image_height", nullable = false)
    private int imageHeight;

    @Column(name = "render_status", nullable = false, length = 40)
    private String renderStatus;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "rendered_at")
    private OffsetDateTime renderedAt;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(String ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceRef() {
        return sourceRef;
    }

    public void setSourceRef(String sourceRef) {
        this.sourceRef = sourceRef;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getImagePath() {
        return imagePath;
    }

    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
    }

    public byte[] getImageBytes() {
        return imageBytes;
    }

    public void setImageBytes(byte[] imageBytes) {
        this.imageBytes = imageBytes;
    }

    public int getImageWidth() {
        return imageWidth;
    }

    public void setImageWidth(int imageWidth) {
        this.imageWidth = imageWidth;
    }

    public int getImageHeight() {
        return imageHeight;
    }

    public void setImageHeight(int imageHeight) {
        this.imageHeight = imageHeight;
    }

    public String getRenderStatus() {
        return renderStatus;
    }

    public void setRenderStatus(String renderStatus) {
        this.renderStatus = renderStatus;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getRenderedAt() {
        return renderedAt;
    }

    public void setRenderedAt(OffsetDateTime renderedAt) {
        this.renderedAt = renderedAt;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(OffsetDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
}
