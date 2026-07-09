package com.zeitplan.backend.entity;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "kindle_devices")
public class KindleDeviceEntity {

    @Id
    @Column(length = 48)
    private String id;

    @Column(name = "owner_user_id", nullable = false, length = 80)
    private String ownerUserId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "device_token_hash", nullable = false, unique = true, length = 120)
    private String deviceTokenHash;

    @Column(name = "current_screen_id", length = 48)
    private String currentScreenId;

    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    @Column(name = "last_ip", length = 120)
    private String lastIp;

    @Column(name = "last_width")
    private Integer lastWidth;

    @Column(name = "last_height")
    private Integer lastHeight;

    @Column(name = "last_battery_percentage")
    private Integer lastBatteryPercentage;

    @Column(name = "last_rssi", length = 80)
    private String lastRssi;

    @Column(name = "last_device_identifier", length = 120)
    private String lastDeviceIdentifier;

    @Column(name = "last_model", length = 120)
    private String lastModel;

    @Column(name = "last_fw_version", length = 120)
    private String lastFwVersion;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "auto_push_enabled", nullable = false)
    private boolean autoPushEnabled = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(String ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDeviceTokenHash() {
        return deviceTokenHash;
    }

    public void setDeviceTokenHash(String deviceTokenHash) {
        this.deviceTokenHash = deviceTokenHash;
    }

    public String getCurrentScreenId() {
        return currentScreenId;
    }

    public void setCurrentScreenId(String currentScreenId) {
        this.currentScreenId = currentScreenId;
    }

    public int getCurrentVersion() {
        return currentVersion;
    }

    public void setCurrentVersion(int currentVersion) {
        this.currentVersion = currentVersion;
    }

    public OffsetDateTime getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(OffsetDateTime lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }

    public String getLastIp() {
        return lastIp;
    }

    public void setLastIp(String lastIp) {
        this.lastIp = lastIp;
    }

    public Integer getLastWidth() {
        return lastWidth;
    }

    public void setLastWidth(Integer lastWidth) {
        this.lastWidth = lastWidth;
    }

    public Integer getLastHeight() {
        return lastHeight;
    }

    public void setLastHeight(Integer lastHeight) {
        this.lastHeight = lastHeight;
    }

    public Integer getLastBatteryPercentage() {
        return lastBatteryPercentage;
    }

    public void setLastBatteryPercentage(Integer lastBatteryPercentage) {
        this.lastBatteryPercentage = lastBatteryPercentage;
    }

    public String getLastRssi() {
        return lastRssi;
    }

    public void setLastRssi(String lastRssi) {
        this.lastRssi = lastRssi;
    }

    public String getLastDeviceIdentifier() {
        return lastDeviceIdentifier;
    }

    public void setLastDeviceIdentifier(String lastDeviceIdentifier) {
        this.lastDeviceIdentifier = lastDeviceIdentifier;
    }

    public String getLastModel() {
        return lastModel;
    }

    public void setLastModel(String lastModel) {
        this.lastModel = lastModel;
    }

    public String getLastFwVersion() {
        return lastFwVersion;
    }

    public void setLastFwVersion(String lastFwVersion) {
        this.lastFwVersion = lastFwVersion;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isAutoPushEnabled() {
        return autoPushEnabled;
    }

    public void setAutoPushEnabled(boolean autoPushEnabled) {
        this.autoPushEnabled = autoPushEnabled;
    }
}
