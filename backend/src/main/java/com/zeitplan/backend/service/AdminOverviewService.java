package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.AdminOverviewResponse;
import com.zeitplan.backend.dto.DailyPlanSummaryResponse;
import com.zeitplan.backend.dto.TaskTypeStatResponse;
import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import org.springframework.http.HttpStatus;
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
    private static final LocalTime MIDDAY_SKIPPED_BREAK_START_TIME = LocalTime.of(11, 55);
    private static final LocalTime NOON_SKIPPED_BREAK_START_TIME = LocalTime.of(12, 0);
    private static final LocalTime SKIPPED_BREAK_START_TIME = LocalTime.of(14, 0);
    private static final LocalTime EVENING_PLAN_START_TIME = LocalTime.of(17, 0);
    private static final LocalTime EVENING_PLAN_END_TIME = LocalTime.of(3, 0);

    private final DailyPlanRepository dailyPlanRepository;

    public AdminOverviewService(DailyPlanRepository dailyPlanRepository) {
        this.dailyPlanRepository = dailyPlanRepository;
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview(LocalDate fromDate, LocalDate toDate) {
        if (toDate.isBefore(fromDate)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "结束日期不能早于开始日期");
        }

        List<DailyPlanEntity> plans = dailyPlanRepository.findAllByPlanDateBetweenOrderByPlanDateAsc(fromDate, toDate);
        List<DailyPlanSummaryResponse> daySummaries = new ArrayList<>();
        Map<Long, StatAccumulator> stats = new LinkedHashMap<>();

        int focusMinutes = 0;

        for (DailyPlanEntity plan : plans) {
            List<PlanTaskEntity> sortedTasks = plan.getTasks().stream()
                    .sorted(Comparator.comparing(PlanTaskEntity::getOrderIndex))
                    .toList();

            List<TimedTask> timedTasks = new ArrayList<>();
            int dayFocusMinutes = 0;
            LocalTime cursor = plan.getDayStartLocalTime();

            for (int index = 0; index < sortedTasks.size(); index++) {
                PlanTaskEntity task = sortedTasks.get(index);
                int breakMinutes = getAutomaticBreakMinutes(index, cursor);
                LocalTime taskStartTime = cursor.plusMinutes(breakMinutes);
                LocalTime taskEndTime = cursor.plusMinutes(task.getDurationMinutes());
                int actualFocusMinutes = Math.max(task.getDurationMinutes() - breakMinutes, 0);
                TimedTask timedTask = new TimedTask(task, taskStartTime, taskEndTime, actualFocusMinutes);
                timedTasks.add(timedTask);

                if (shouldIncludeInStatistics(plan, taskStartTime) && isFocusTask(task.getTaskType())) {
                    dayFocusMinutes += actualFocusMinutes;
                }
                cursor = taskEndTime;
            }

            focusMinutes += dayFocusMinutes;

            List<TimedTask> statsEligibleTasks = timedTasks.stream()
                    .filter(timedTask -> shouldIncludeInStatistics(plan, timedTask.startTime()))
                    .toList();

            LocalTime firstTime = statsEligibleTasks.isEmpty()
                    ? null
                    : statsEligibleTasks.getFirst().startTime();
            LocalTime lastTime = statsEligibleTasks.isEmpty()
                    ? null
                    : statsEligibleTasks.getLast().endTime();

            daySummaries.add(new DailyPlanSummaryResponse(
                    plan.getPlanDate(),
                    plan.getSeasonMode(),
                    statsEligibleTasks.size(),
                    dayFocusMinutes,
                    firstTime,
                    lastTime,
                    statsEligibleTasks.stream().limit(3).map(timedTask -> timedTask.task().getTitle()).toList()
            ));

            for (TimedTask timedTask : statsEligibleTasks) {
                PlanTaskEntity task = timedTask.task();
                TaskTypeEntity taskType = task.getTaskType();
                if (isFocusTask(taskType)) {
                    stats.computeIfAbsent(
                            taskType.getId(),
                            ignored -> new StatAccumulator(
                                    taskType.getId(),
                                    taskType.getName(),
                                    taskType.getIconKey(),
                                    taskType.getColorHex()
                            )
                    ).add(timedTask.focusMinutes());
                }
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

        return new AdminOverviewResponse(fromDate, toDate, plans.size(), focusMinutes, daySummaries, typeStats);
    }

    private boolean isFocusTask(TaskTypeEntity taskType) {
        return taskType != null && taskType.isFocusTask();
    }

    private boolean shouldIncludeInStatistics(DailyPlanEntity plan, LocalTime taskStartTime) {
        return plan.isNightPlanEnabled() || !isWithinNightPlan(taskStartTime);
    }

    private int getAutomaticBreakMinutes(int taskIndex, LocalTime boundaryTime) {
        if (taskIndex == 0) {
            return 0;
        }

        if (MIDDAY_SKIPPED_BREAK_START_TIME.equals(boundaryTime)
                || NOON_SKIPPED_BREAK_START_TIME.equals(boundaryTime)
                || SKIPPED_BREAK_START_TIME.equals(boundaryTime)
                || isWithinNightPlan(boundaryTime)) {
            return 0;
        }

        return BREAK_MINUTES;
    }

    private boolean isWithinNightPlan(LocalTime time) {
        return !time.isBefore(EVENING_PLAN_START_TIME) || time.isBefore(EVENING_PLAN_END_TIME);
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

    private record TimedTask(
            PlanTaskEntity task,
            LocalTime startTime,
            LocalTime endTime,
            int focusMinutes
    ) {
    }
}
