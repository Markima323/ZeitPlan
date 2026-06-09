package com.zeitplan.backend.entity;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "dice_rolls")
public class DiceRollEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private DailyPlanEntity plan;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DicePhase phase;

    @Column(nullable = false)
    private Integer value;

    @Column(name = "reward_unlocked", nullable = false)
    private Boolean rewardUnlocked;

    @Column(nullable = false, length = 500)
    private String message;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public DailyPlanEntity getPlan() {
        return plan;
    }

    public void setPlan(DailyPlanEntity plan) {
        this.plan = plan;
    }

    public DicePhase getPhase() {
        return phase;
    }

    public void setPhase(DicePhase phase) {
        this.phase = phase;
    }

    public Integer getValue() {
        return value;
    }

    public void setValue(Integer value) {
        this.value = value;
    }

    public Boolean getRewardUnlocked() {
        return rewardUnlocked;
    }

    public void setRewardUnlocked(Boolean rewardUnlocked) {
        this.rewardUnlocked = rewardUnlocked;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
