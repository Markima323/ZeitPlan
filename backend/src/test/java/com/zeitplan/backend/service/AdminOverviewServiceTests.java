package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.AdminOverviewResponse;
import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;
import com.zeitplan.backend.entity.SeasonMode;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminOverviewServiceTests {

    private static final LocalDate DATE = LocalDate.of(2026, 10, 27);
    private final DailyPlanRepository repository = mock(DailyPlanRepository.class);
    private final AdminOverviewService service = new AdminOverviewService(repository);

    @ParameterizedTest
    @CsvSource({
            "SUMMER, , true, 115, 2, 17:00",
            "WINTER, , true, 120, 2, 17:00",
            "WINTER, , false, 60, 1, 16:00",
            "SUMMER, 16:30, false, 85, 2, 16:30",
            "WINTER, 16:30, true, 115, 2, 17:00",
            "WINTER, 18:00, false, 115, 2, 17:00"
    })
    void statisticsUseSeasonalOrCustomSplit(SeasonMode season, String customSplit, boolean nightEnabled,
            int expectedMinutes, int expectedTasks, LocalTime expectedEnd) {
        givenPlan(season, customSplit, nightEnabled, LocalTime.of(15, 0), 60, 60);

        AdminOverviewResponse overview = service.getOverview(DATE, DATE);

        assertThat(overview.focusMinutes()).isEqualTo(expectedMinutes);
        assertThat(overview.typeStats()).singleElement().satisfies(stat ->
                assertThat(stat.totalMinutes()).isEqualTo(expectedMinutes));
        assertThat(overview.days()).singleElement().satisfies(day -> {
            assertThat(day.taskCount()).isEqualTo(expectedTasks);
            assertThat(day.lastLocalEndTime()).isEqualTo(expectedEnd);
        });
    }

    @ParameterizedTest
    @CsvSource({"15:30, 90, 30, 15:30, 16:00", "23:00, 300, 60, 03:00, 04:00"})
    void disabledNightPlanCountsOnlyDaytimePortion(LocalTime start, int duration, int minutes,
            LocalTime expectedStart, LocalTime expectedEnd) {
        givenPlan(SeasonMode.WINTER, null, false, start, duration);

        AdminOverviewResponse overview = service.getOverview(DATE, DATE);

        assertThat(overview.focusMinutes()).isEqualTo(minutes);
        assertThat(overview.days().getFirst().firstLocalStartTime()).isEqualTo(expectedStart);
        assertThat(overview.days().getFirst().lastLocalEndTime()).isEqualTo(expectedEnd);
    }

    private void givenPlan(SeasonMode season, String customSplit, boolean nightEnabled, LocalTime start, int... durations) {
        DailyPlanEntity plan = new DailyPlanEntity();
        plan.setPlanDate(DATE);
        plan.setSeasonMode(season);
        plan.setDayStartLocalTime(start);
        plan.setNightStartLocalTime(customSplit == null ? null : LocalTime.parse(customSplit));
        plan.setNightPlanEnabled(nightEnabled);
        TaskTypeEntity type = new TaskTypeEntity();
        type.setId(1L);
        type.setName("Focus");
        type.setFocusTask(true);
        for (int index = 0; index < durations.length; index++) {
            PlanTaskEntity task = new PlanTaskEntity();
            task.setTitle("Task " + index);
            task.setTaskType(type);
            task.setOrderIndex(index);
            task.setDurationMinutes(durations[index]);
            plan.getTasks().add(task);
        }
        when(repository.findAllByPlanDateBetweenOrderByPlanDateAsc(DATE, DATE)).thenReturn(List.of(plan));
    }
}
