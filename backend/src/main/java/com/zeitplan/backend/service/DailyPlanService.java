package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.DailyPlanRequest;
import com.zeitplan.backend.dto.DailyPlanResponse;
import com.zeitplan.backend.dto.PlanTaskRequest;
import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.PlanTaskEntity;
import com.zeitplan.backend.entity.SeasonMode;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import com.zeitplan.backend.repository.TaskTypeRepository;
import com.zeitplan.backend.service.mapper.PlanMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class DailyPlanService {

    private static final int BREAK_MINUTES = 5;

    private final DailyPlanRepository dailyPlanRepository;
    private final TaskTypeRepository taskTypeRepository;

    public DailyPlanService(DailyPlanRepository dailyPlanRepository, TaskTypeRepository taskTypeRepository) {
        this.dailyPlanRepository = dailyPlanRepository;
        this.taskTypeRepository = taskTypeRepository;
    }

    @Transactional(readOnly = true)
    public DailyPlanResponse getPlan(LocalDate planDate) {
        return dailyPlanRepository.findByPlanDate(planDate)
                .map(PlanMapper::toResponse)
                .orElseGet(() -> new DailyPlanResponse(null, planDate, SeasonMode.SUMMER, LocalTime.of(10, 0), List.of()));
    }

    @Transactional(readOnly = true)
    public Optional<DailyPlanResponse> getLatestPlanBefore(LocalDate planDate) {
        return dailyPlanRepository.findFirstByPlanDateBeforeOrderByPlanDateDesc(planDate)
                .map(PlanMapper::toResponse);
    }

    @Transactional
    public DailyPlanResponse savePlan(LocalDate pathDate, DailyPlanRequest request) {
        if (!pathDate.equals(request.planDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "路径日期和请求体中的计划日期不一致");
        }

        validateFiveMinuteStep(request.dayStartLocalTime());

        DailyPlanEntity entity = dailyPlanRepository.findByPlanDate(pathDate)
                .orElseGet(DailyPlanEntity::new);

        entity.setPlanDate(pathDate);
        entity.setSeasonMode(request.seasonMode());
        entity.setDayStartLocalTime(request.dayStartLocalTime());

        Map<Long, PlanTaskEntity> existingTasks = new HashMap<>();
        entity.getTasks().forEach(task -> existingTasks.put(task.getId(), task));
        entity.getTasks().clear();

        List<PlanTaskRequest> sortedTasks = request.tasks()
                .stream()
                .sorted(Comparator.comparing(task -> task.orderIndex() == null ? Integer.MAX_VALUE : task.orderIndex()))
                .toList();

        for (int index = 0; index < sortedTasks.size(); index++) {
            PlanTaskRequest taskRequest = sortedTasks.get(index);
            validateDuration(taskRequest.durationMinutes());

            PlanTaskEntity task = taskRequest.id() != null
                    ? existingTasks.getOrDefault(taskRequest.id(), new PlanTaskEntity())
                    : new PlanTaskEntity();

            task.setPlan(entity);
            task.setTaskType(resolveTaskType(taskRequest.taskTypeId()));
            task.setTitle(taskRequest.title() == null || taskRequest.title().isBlank() ? "未命名任务" : taskRequest.title().trim());
            task.setDurationMinutes(taskRequest.durationMinutes());
            task.setOrderIndex(index);
            entity.getTasks().add(task);
        }

        DailyPlanEntity saved = dailyPlanRepository.save(entity);
        return PlanMapper.toResponse(saved);
    }

    private TaskTypeEntity resolveTaskType(Long taskTypeId) {
        if (taskTypeId == null) {
            return null;
        }

        return taskTypeRepository.findById(taskTypeId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "任务类型不存在"));
    }

    private void validateDuration(Integer durationMinutes) {
        if (durationMinutes == null || durationMinutes < 10 || durationMinutes > 1440 || durationMinutes % BREAK_MINUTES != 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "任务时长需要是 10 到 1440 分钟之间的 5 分钟整数倍");
        }
    }

    private void validateFiveMinuteStep(LocalTime time) {
        if (time.getMinute() % BREAK_MINUTES != 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "开始时间需要按 5 分钟为单位设置");
        }
    }
}
