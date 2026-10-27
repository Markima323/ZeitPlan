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
