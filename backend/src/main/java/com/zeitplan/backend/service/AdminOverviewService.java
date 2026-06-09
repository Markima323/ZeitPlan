package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.AdminOverviewResponse;
import com.zeitplan.backend.dto.DailyPlanSummaryResponse;
import com.zeitplan.backend.dto.TaskTypeStatResponse;
import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminOverviewService {

    private static final int BREAK_MINUTES = 5;
    private static final String FALLBACK_NAME = "未分类";
    private static final String FALLBACK_ICON = "sparkles";
    private static final String FALLBACK_COLOR = "#F47B20";

    private final DailyPlanRepository dailyPlanRepository;

    public AdminOverviewService(DailyPlanRepository dailyPlanRepository) {
        this.dailyPlanRepository = dailyPlanRepository;
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview(LocalDate fromDate, LocalDate toDate) {
        if (toDate.isBefore(fromDate)) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "结束日期不能早于开始日期");
        }

        List<DailyPlanEntity> plans = dailyPlanRepository.findAllByPlanDateBetweenOrderByPlanDateAsc(fromDate, toDate);
        List<DailyPlanSummaryResponse> daySummaries = new ArrayList<>();
        Map<String, StatAccumulator> stats = new LinkedHashMap<>();

        int focusMinutes = 0;
        int breakMinutes = 0;

        for (DailyPlanEntity plan : plans) {
            List<PlanTaskEntity> sortedTasks = plan.getTasks().stream()
                    .sorted(Comparator.comparing(PlanTaskEntity::getOrderIndex))
                    .toList();

            int dayFocusMinutes = 0;
            int daySlotMinutes = 0;
            for (int index = 0; index < sortedTasks.size(); index++) {
                PlanTaskEntity task = sortedTasks.get(index);
                daySlotMinutes += task.getDurationMinutes();
                dayFocusMinutes += index == 0
                        ? task.getDurationMinutes()
                        : Math.max(task.getDurationMinutes() - BREAK_MINUTES, 0);
            }

            int dayBreakMinutes = Math.max(sortedTasks.size() - 1, 0) * BREAK_MINUTES;
            focusMinutes += dayFocusMinutes;
            breakMinutes += dayBreakMinutes;

            LocalTime lastTime = null;
            if (!sortedTasks.isEmpty()) {
                lastTime = plan.getDayStartLocalTime().plusMinutes(daySlotMinutes);
            }

            daySummaries.add(new DailyPlanSummaryResponse(
                    plan.getPlanDate(),
                    plan.getSeasonMode(),
                    sortedTasks.size(),
                    dayFocusMinutes,
                    dayBreakMinutes,
                    sortedTasks.isEmpty() ? null : plan.getDayStartLocalTime(),
                    lastTime,
                    sortedTasks.stream().limit(3).map(PlanTaskEntity::getTitle).toList()
            ));

            for (int index = 0; index < sortedTasks.size(); index++) {
                PlanTaskEntity task = sortedTasks.get(index);
                int actualFocusMinutes = index == 0
                        ? task.getDurationMinutes()
                        : Math.max(task.getDurationMinutes() - BREAK_MINUTES, 0);
                TaskTypeEntity taskType = task.getTaskType();
                String key = taskType != null ? taskType.getId().toString() : "fallback";
                stats.computeIfAbsent(
                                key,
                                ignored -> new StatAccumulator(
                                        taskType != null ? taskType.getId() : null,
                                        taskType != null ? taskType.getName() : FALLBACK_NAME,
                                        taskType != null ? taskType.getIconKey() : FALLBACK_ICON,
                                        taskType != null ? taskType.getColorHex() : FALLBACK_COLOR
                                ))
                        .add(actualFocusMinutes);
            }
        }

        List<TaskTypeStatResponse> typeStats = stats.values().stream()
                .sorted(Comparator.comparingInt(StatAccumulator::totalMinutes).reversed())
                .map(item -> new TaskTypeStatResponse(
                        item.id(),
                        item.name(),
                        item.icon(),
                        item.color(),
                        item.totalMinutes()
                ))
                .toList();

        return new AdminOverviewResponse(fromDate, toDate, plans.size(), focusMinutes, breakMinutes, daySummaries, typeStats);
    }

    private static final class StatAccumulator {
        private final Long id;
        private final String name;
        private final String icon;
        private final String color;
        private int totalMinutes;

        private StatAccumulator(Long id, String name, String icon, String color) {
            this.id = id;
            this.name = name;
            this.icon = icon;
            this.color = color;
        }

        private void add(int minutes) {
            totalMinutes += minutes;
        }

        private Long id() {
            return id;
        }

        private String name() {
            return name;
        }

        private String icon() {
            return icon;
        }

        private String color() {
            return color;
        }

        private int totalMinutes() {
            return totalMinutes;
        }
    }
}
