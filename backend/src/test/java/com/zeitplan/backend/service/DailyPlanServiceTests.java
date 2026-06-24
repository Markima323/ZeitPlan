package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.DailyPlanRequest;
import com.zeitplan.backend.dto.DailyPlanResponse;
import com.zeitplan.backend.dto.PlanTaskRequest;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.entity.SeasonMode;
import com.zeitplan.backend.repository.DailyPlanRepository;
import com.zeitplan.backend.repository.TaskTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class DailyPlanServiceTests {

    @Autowired
    private DailyPlanService dailyPlanService;

    @Autowired
    private DailyPlanRepository dailyPlanRepository;

    @Autowired
    private TaskTypeRepository taskTypeRepository;

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
                        List.of(new PlanTaskRequest(null, "每日计划", null, 30, 0, null))
                )
        );

        assertThat(savedPlan.tasks()).hasSize(1);
        assertThat(savedPlan.tasks().get(0).taskTypeAutoLocked()).isTrue();
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
