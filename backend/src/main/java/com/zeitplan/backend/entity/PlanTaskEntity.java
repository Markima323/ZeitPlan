package com.zeitplan.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "plan_tasks")
public class PlanTaskEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private DailyPlanEntity plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_type_id")
    private TaskTypeEntity taskType;

    @Column(nullable = false, length = 240)
    private String title;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(name = "task_type_auto_locked", nullable = false)
    private boolean taskTypeAutoLocked = true;

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

    public TaskTypeEntity getTaskType() {
        return taskType;
    }

    public void setTaskType(TaskTypeEntity taskType) {
        this.taskType = taskType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public Integer getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(Integer orderIndex) {
        this.orderIndex = orderIndex;
    }

    public boolean isTaskTypeAutoLocked() {
        return taskTypeAutoLocked;
    }

    public void setTaskTypeAutoLocked(boolean taskTypeAutoLocked) {
        this.taskTypeAutoLocked = taskTypeAutoLocked;
    }
}
