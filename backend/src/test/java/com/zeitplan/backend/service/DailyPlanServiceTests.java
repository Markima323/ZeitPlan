package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.DailyPlanRequest;
import com.zeitplan.backend.dto.DailyPlanResponse;
import com.zeitplan.backend.dto.PlanTaskRequest;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.entity.SeasonMode;
import com.zeitplan.backend.repository.DailyPlanRepository;
import com.zeitplan.backend.repository.TaskTypeRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class DailyPlanServiceTests {

    @Autowired
    private DailyPlanService dailyPlanService;

    @Autowired
    private DailyPlanRepository dailyPlanRepository;

    @Autowired
    private TaskTypeRepository taskTypeRepository;

    @Autowired
    private EntityManager entityManager;

    @BeforeEach
    void setUp() {
        dailyPlanRepository.deleteAllInBatch();
        taskTypeRepository.deleteAllInBatch();
    }

    @Test
    void savePlanPersistsTaskTypeAutoLockFlag() {
        TaskTypeEntity taskType = taskTypeRepository.save(taskType("深度工作"));
        LocalDate planDate = LocalDate.of(2026, 6, 24);

        DailyPlanResponse savedPlan = dailyPlanService.savePlan(
                planDate,
                new DailyPlanRequest(
                        planDate,
                        SeasonMode.SUMMER,
                        LocalTime.of(10, 0),
                        true,
                        null,
                        List.of(new PlanTaskRequest(null, "开发", taskType.getId(), 30, 0, false))
                )
        );

        assertThat(savedPlan.tasks()).hasSize(1);
        assertThat(savedPlan.tasks().get(0).taskTypeAutoLocked()).isFalse();
        assertThat(dailyPlanService.getPlan(planDate).tasks().get(0).taskTypeAutoLocked()).isFalse();
    }

    @Test
    void savePlanDefaultsAutoLockFlagToTrueWhenOlderClientsOmitIt() {
        LocalDate planDate = LocalDate.of(2026, 6, 25);

        DailyPlanResponse savedPlan = dailyPlanService.savePlan(
                planDate,
                new DailyPlanRequest(
                        planDate,
                        SeasonMode.SUMMER,
                        LocalTime.of(10, 0),
                        true,
                        null,
                        List.of(new PlanTaskRequest(null, "每日计划", null, 30, 0, null))
                )
        );

        assertThat(savedPlan.tasks()).hasSize(1);
        assertThat(savedPlan.tasks().get(0).taskTypeAutoLocked()).isTrue();
    }

    @Test
    void customNightSplitPersistsAndCanResetToSeasonalDefault() {
        LocalDate date = LocalDate.of(2026, 10, 27);
        DailyPlanResponse saved = dailyPlanService.savePlan(date, new DailyPlanRequest(
                date, SeasonMode.WINTER, LocalTime.of(10, 0), true, LocalTime.of(18, 30), List.of()));
        entityManager.flush();
        entityManager.clear();

        assertThat(saved.nightStartLocalTime()).isEqualTo(LocalTime.of(18, 30));
        assertThat(dailyPlanService.getPlan(date).nightStartLocalTime()).isEqualTo(LocalTime.of(18, 30));
        assertThat(dailyPlanService.getLatestPlanBefore(date.plusDays(1)).orElseThrow().nightStartLocalTime())
                .isEqualTo(LocalTime.of(18, 30));

        dailyPlanService.savePlan(date, new DailyPlanRequest(
                date, SeasonMode.WINTER, LocalTime.of(10, 0), true, null, List.of()));
        entityManager.flush();
        entityManager.clear();

        assertThat(dailyPlanService.getPlan(date).nightStartLocalTime()).isNull();
        assertThat(PlanScheduleRules.nightStartMinutes(dailyPlanRepository.findByPlanDate(date).orElseThrow()))
                .isEqualTo(16 * 60);
    }

    @ParameterizedTest
    @ValueSource(strings = {"05:55", "16:01", "16:00:01", "16:00:00.001", "23:59"})
    void invalidNightSplitIsRejected(String value) {
        LocalDate date = LocalDate.of(2026, 10, 27);
        assertThatThrownBy(() -> dailyPlanService.savePlan(date, new DailyPlanRequest(
                date, SeasonMode.WINTER, LocalTime.of(10, 0), true, LocalTime.parse(value), List.of())))
                .isInstanceOf(ApiException.class).hasMessageContaining("日夜分割时间");
        assertThat(dailyPlanRepository.findByPlanDate(date)).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(SeasonMode.class)
    void newDateInheritsLatestEarlierSeasonWithoutCreatingPlan(SeasonMode seasonMode) {
        LocalDate date = LocalDate.of(2026, 10, 28);
        SeasonMode otherMode = seasonMode == SeasonMode.WINTER ? SeasonMode.SUMMER : SeasonMode.WINTER;
        saveEmptyPlan(date.minusDays(3), otherMode);
        saveEmptyPlan(date.minusDays(1), seasonMode);
        saveEmptyPlan(date.plusDays(1), otherMode);
        entityManager.flush();
        entityManager.clear();

        DailyPlanResponse plan = dailyPlanService.getPlan(date);

        assertThat(plan.seasonMode()).isEqualTo(seasonMode);
        assertThat(plan.id()).isNull();
        assertThat(plan.planDate()).isEqualTo(date);
        assertThat(plan.tasks()).isEmpty();
        assertThat(plan.dayStartLocalTime()).isEqualTo(LocalTime.of(10, 0));
        assertThat(dailyPlanRepository.findByPlanDate(date)).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(SeasonMode.class)
    void savedDateKeepsItsOwnSeasonMode(SeasonMode seasonMode) {
        LocalDate date = LocalDate.of(2026, 10, 28);
        SeasonMode otherMode = seasonMode == SeasonMode.WINTER ? SeasonMode.SUMMER : SeasonMode.WINTER;
        saveEmptyPlan(date.minusDays(1), otherMode);
        saveEmptyPlan(date, seasonMode);
        saveEmptyPlan(date.plusDays(1), otherMode);
        entityManager.flush();
        entityManager.clear();

        assertThat(dailyPlanService.getPlan(date).seasonMode()).isEqualTo(seasonMode);
    }

    @Test
    void newDateWithoutEarlierPlansKeepsDefaultSeasonMode() {
        LocalDate date = LocalDate.of(2026, 10, 28);
        saveEmptyPlan(date.plusDays(1), SeasonMode.WINTER, LocalTime.of(11, 15));

        assertThat(dailyPlanService.getPlan(date).seasonMode()).isEqualTo(SeasonMode.SUMMER);
        assertThat(dailyPlanService.getPlan(date).dayStartLocalTime()).isEqualTo(LocalTime.of(10, 0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"09:30", "11:15", "00:00"})
    void newDateInheritsLatestEarlierStartTime(String value) {
        LocalDate date = LocalDate.of(2026, 10, 30);
        LocalTime startTime = LocalTime.parse(value);
        saveEmptyPlan(date.minusDays(4), SeasonMode.SUMMER, LocalTime.of(8, 0));
        saveEmptyPlan(date.minusDays(2), SeasonMode.WINTER, startTime);
        saveEmptyPlan(date.plusDays(1), SeasonMode.SUMMER, LocalTime.of(12, 0));
        entityManager.flush();
        entityManager.clear();

        DailyPlanResponse plan = dailyPlanService.getPlan(date);

        assertThat(plan.dayStartLocalTime()).isEqualTo(startTime);
        assertThat(plan.seasonMode()).isEqualTo(SeasonMode.WINTER);
        assertThat(plan.id()).isNull();
        assertThat(dailyPlanRepository.findByPlanDate(date)).isEmpty();

        dailyPlanService.savePlan(date, new DailyPlanRequest(
                date, plan.seasonMode(), plan.dayStartLocalTime(), true, null, List.of()));
        entityManager.flush();
        entityManager.clear();

        assertThat(dailyPlanService.getPlan(date).dayStartLocalTime()).isEqualTo(startTime);
    }

    @Test
    void savedDateKeepsItsOwnStartTime() {
        LocalDate date = LocalDate.of(2026, 10, 30);
        saveEmptyPlan(date.minusDays(1), SeasonMode.WINTER, LocalTime.of(9, 30));
        saveEmptyPlan(date, SeasonMode.WINTER, LocalTime.of(10, 0));
        saveEmptyPlan(date.plusDays(1), SeasonMode.WINTER, LocalTime.of(11, 15));
        entityManager.flush();
        entityManager.clear();

        assertThat(dailyPlanService.getPlan(date).dayStartLocalTime()).isEqualTo(LocalTime.of(10, 0));
    }

    private void saveEmptyPlan(LocalDate date, SeasonMode seasonMode) {
        saveEmptyPlan(date, seasonMode, LocalTime.of(10, 0));
    }

    private void saveEmptyPlan(LocalDate date, SeasonMode seasonMode, LocalTime startTime) {
        dailyPlanService.savePlan(date, new DailyPlanRequest(
                date, seasonMode, startTime, true, null, List.of()));
    }

    private TaskTypeEntity taskType(String name) {
        TaskTypeEntity entity = new TaskTypeEntity();
        entity.setName(name);
        entity.setIconKey("code");
        entity.setColorHex("#123456");
        entity.setDescription(name + " description");
        entity.setFocusTask(true);
        entity.setSortOrder(0);
        return entity;
    }
}
