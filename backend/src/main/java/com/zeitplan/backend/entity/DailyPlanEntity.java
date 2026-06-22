package com.zeitplan.backend.entity;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "daily_plans")
public class DailyPlanEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_date", nullable = false, unique = true)
    private LocalDate planDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "season_mode", nullable = false, length = 16)
    private SeasonMode seasonMode;

    @Column(name = "day_start_local_time", nullable = false)
    private LocalTime dayStartLocalTime;

    @Column(name = "night_plan_enabled", nullable = false)
    private boolean nightPlanEnabled = true;

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PlanTaskEntity> tasks = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getPlanDate() {
        return planDate;
    }

    public void setPlanDate(LocalDate planDate) {
        this.planDate = planDate;
    }

    public SeasonMode getSeasonMode() {
        return seasonMode;
    }

    public void setSeasonMode(SeasonMode seasonMode) {
        this.seasonMode = seasonMode;
    }

    public LocalTime getDayStartLocalTime() {
        return dayStartLocalTime;
    }

    public void setDayStartLocalTime(LocalTime dayStartLocalTime) {
        this.dayStartLocalTime = dayStartLocalTime;
    }

    public List<PlanTaskEntity> getTasks() {
        return tasks;
    }

    public void setTasks(List<PlanTaskEntity> tasks) {
        this.tasks = tasks;
    }

    public boolean isNightPlanEnabled() {
        return nightPlanEnabled;
    }

    public void setNightPlanEnabled(boolean nightPlanEnabled) {
        this.nightPlanEnabled = nightPlanEnabled;
    }
}
