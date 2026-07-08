package com.zeitplan.backend.service;

import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;

@Service
public class KindleTodaySnapshotService {

    private static final int BREAK_MINUTES = 5;
    private static final int MIDDAY_SKIPPED_BREAK_START_MINUTES = (11 * 60) + 55;
    private static final int NOON_SKIPPED_BREAK_START_MINUTES = 12 * 60;
    private static final int AFTERNOON_SKIPPED_BREAK_START_MINUTES = 14 * 60;
    private static final int EVENING_PLAN_START_MINUTES = 17 * 60;
    private static final int EVENING_PLAN_END_MINUTES = 3 * 60;

    private final DailyPlanRepository dailyPlanRepository;
    private final Clock clock;
    private final ZoneId zoneId;

    public KindleTodaySnapshotService(
            DailyPlanRepository dailyPlanRepository,
            Clock clock,
            @Value("${app.kindle.zone:Europe/Berlin}") String zoneId
    ) {
        this.dailyPlanRepository = dailyPlanRepository;
        this.clock = clock;
        this.zoneId = ZoneId.of(zoneId);
    }

    @Transactional(readOnly = true)
    public KindleTodaySnapshot getCurrentSnapshot() {
        LocalDate today = LocalDate.now(clock.withZone(zoneId));
        LocalTime now = LocalTime.now(clock.withZone(zoneId));
        return getCurrentSnapshot(today, now);
    }

    @Transactional(readOnly = true)
    public KindleTodaySnapshot getCurrentSnapshot(LocalDate planDate, LocalTime now) {
        return dailyPlanRepository.findByPlanDate(planDate)
                .map(plan -> buildSnapshot(plan, now))
                .orElseGet(() -> emptySnapshot(planDate));
    }

    private KindleTodaySnapshot buildSnapshot(DailyPlanEntity plan, LocalTime now) {
        List<PlanTaskEntity> tasks = plan.getTasks().stream()
                .sorted(Comparator.comparing(PlanTaskEntity::getOrderIndex))
                .toList();

        int cursor = toMinutes(plan.getDayStartLocalTime());
        int nowMinutes = toMinutes(now);
        if (nowMinutes < cursor) {
            nowMinutes += 1440;
        }

        for (int index = 0; index < tasks.size(); index++) {
            PlanTaskEntity task = tasks.get(index);
            int breakMinutesBefore = getAutomaticBreakMinutes(index, cursor);
            int taskStart = cursor + breakMinutesBefore;
            int taskEnd = cursor + Math.max(BREAK_MINUTES * 2, task.getDurationMinutes());

            if (nowMinutes >= taskStart && nowMinutes < taskEnd) {
                return new KindleTodaySnapshot(
                        plan.getPlanDate(),
                        task.getId() == null ? "order-" + task.getOrderIndex() : task.getId().toString(),
                        task.getTitle(),
                        task.getTaskType() == null ? "未分类" : task.getTaskType().getName(),
                        toClock(taskStart),
                        toClock(taskEnd),
                        resolveNextTitle(tasks, index),
                        OffsetDateTime.now(clock.withZone(zoneId))
                );
            }

            cursor = taskEnd;
        }

        return emptySnapshot(plan.getPlanDate());
    }

    private KindleTodaySnapshot emptySnapshot(LocalDate planDate) {
        return new KindleTodaySnapshot(
                planDate,
                null,
                null,
                null,
                null,
                null,
                null,
                OffsetDateTime.now(clock.withZone(zoneId))
        );
    }

    private String resolveNextTitle(List<PlanTaskEntity> tasks, int currentIndex) {
        if (currentIndex + 1 >= tasks.size()) {
            return null;
        }

        return tasks.get(currentIndex + 1).getTitle();
    }

    private int getAutomaticBreakMinutes(int taskIndex, int boundaryMinutes) {
        if (taskIndex == 0) {
            return 0;
        }

        int normalizedBoundary = Math.floorMod(boundaryMinutes, 1440);
        if (
                normalizedBoundary == MIDDAY_SKIPPED_BREAK_START_MINUTES ||
                normalizedBoundary == NOON_SKIPPED_BREAK_START_MINUTES ||
                normalizedBoundary == AFTERNOON_SKIPPED_BREAK_START_MINUTES ||
                isWithinNightPlan(normalizedBoundary)
        ) {
            return 0;
        }

        return BREAK_MINUTES;
    }

    private boolean isWithinNightPlan(int minutes) {
        int normalizedMinutes = Math.floorMod(minutes, 1440);
        return normalizedMinutes >= EVENING_PLAN_START_MINUTES || normalizedMinutes < EVENING_PLAN_END_MINUTES;
    }

    private int toMinutes(LocalTime time) {
        return (time.getHour() * 60) + time.getMinute();
    }

    private LocalTime toClock(int totalMinutes) {
        int normalized = Math.floorMod(totalMinutes, 1440);
        return LocalTime.of(normalized / 60, normalized % 60);
    }
}
