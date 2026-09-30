package com.zeitplan.backend.service;

import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KindleTodaySnapshotServiceTests {

    private static final LocalDate PLAN_DATE = LocalDate.of(2026, 9, 30);

    private final DailyPlanRepository dailyPlanRepository = mock(DailyPlanRepository.class);
    private final KindleTodaySnapshotService service =
            new KindleTodaySnapshotService(dailyPlanRepository, Clock.systemUTC(), "Europe/Berlin");

    @Test
    void automaticBreakShowsUpcomingTask() {
        // 10:00-11:00 first task, 11:00-11:05 automatic break, 11:05-12:00 second task.
        givenPlan(task(1L, "写周报", 60), task(2L, "整理邮件", 60), task(3L, "午饭", 60));

        KindleTodaySnapshot snapshot = service.getCurrentSnapshot(PLAN_DATE, LocalTime.of(11, 1));

        assertThat(snapshot.hasCurrentItem()).isTrue();
        assertThat(snapshot.onBreak()).isTrue();
        assertThat(snapshot.title()).isEqualTo("整理邮件");
        assertThat(snapshot.startTime()).isEqualTo(LocalTime.of(11, 5));
        assertThat(snapshot.endTime()).isEqualTo(LocalTime.of(12, 0));
        assertThat(snapshot.nextTitle()).isEqualTo("午饭");
    }

    @Test
    void taskAfterBreakIsCurrentAndFingerprintChanges() {
        givenPlan(task(1L, "写周报", 60), task(2L, "整理邮件", 60));

        KindleTodaySnapshot onBreak = service.getCurrentSnapshot(PLAN_DATE, LocalTime.of(11, 4));
        KindleTodaySnapshot running = service.getCurrentSnapshot(PLAN_DATE, LocalTime.of(11, 5));

        assertThat(running.onBreak()).isFalse();
        assertThat(running.title()).isEqualTo("整理邮件");
        assertThat(running.fingerprint()).isNotEqualTo(onBreak.fingerprint());
    }

    @Test
    void afterLastTaskShowsEmptyScreen() {
        givenPlan(task(1L, "写周报", 60));

        KindleTodaySnapshot snapshot = service.getCurrentSnapshot(PLAN_DATE, LocalTime.of(11, 1));

        assertThat(snapshot.hasCurrentItem()).isFalse();
        assertThat(snapshot.onBreak()).isFalse();
    }

    private void givenPlan(PlanTaskEntity... tasks) {
        DailyPlanEntity plan = new DailyPlanEntity();
        plan.setPlanDate(PLAN_DATE);
        plan.setDayStartLocalTime(LocalTime.of(10, 0));
        List<PlanTaskEntity> taskList = new ArrayList<>(List.of(tasks));
        plan.setTasks(taskList);
        when(dailyPlanRepository.findByPlanDate(PLAN_DATE)).thenReturn(Optional.of(plan));
    }

    private PlanTaskEntity task(Long id, String title, int durationMinutes) {
        PlanTaskEntity task = new PlanTaskEntity();
        task.setId(id);
        task.setTitle(title);
        task.setDurationMinutes(durationMinutes);
        task.setOrderIndex(id.intValue() - 1);
        return task;
    }
}
