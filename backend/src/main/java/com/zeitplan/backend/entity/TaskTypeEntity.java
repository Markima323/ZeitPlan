package com.zeitplan.backend.entity;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "task_types")
public class TaskTypeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(name = "icon_key", nullable = false, length = 80)
    private String iconKey;

    @Column(name = "color_hex", nullable = false, length = 16)
    private String colorHex;

    @Column(nullable = false, length = 500)
    private String description = "";

    @Column(name = "focus_task", nullable = false)
    private boolean focusTask = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "task_type_keywords", joinColumns = @JoinColumn(name = "task_type_id"))
    @OrderColumn(name = "keyword_order")
    @Column(name = "keyword", nullable = false, length = 120)
    private List<String> keywords = new ArrayList<>();

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIconKey() {
        return iconKey;
    }

    public void setIconKey(String iconKey) {
        this.iconKey = iconKey;
    }

    public String getColorHex() {
        return colorHex;
    }

    public void setColorHex(String colorHex) {
        this.colorHex = colorHex;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isFocusTask() {
        return focusTask;
    }

    public void setFocusTask(boolean focusTask) {
        this.focusTask = focusTask;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public List<String> getKeywords() {
        return keywords;
    }

    public void setKeywords(List<String> keywords) {
        this.keywords.clear();
        this.keywords.addAll(keywords);
    }
}
