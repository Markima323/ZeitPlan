package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.TaskTypeRequest;
import com.zeitplan.backend.dto.TaskTypeResponse;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.PlanTaskRepository;
import com.zeitplan.backend.repository.TaskTypeRepository;
import com.zeitplan.backend.service.mapper.TaskTypeMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TaskTypeService {

    private final TaskTypeRepository taskTypeRepository;
    private final PlanTaskRepository planTaskRepository;

    public TaskTypeService(TaskTypeRepository taskTypeRepository, PlanTaskRepository planTaskRepository) {
        this.taskTypeRepository = taskTypeRepository;
        this.planTaskRepository = planTaskRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskTypeResponse> getAll() {
        return taskTypeRepository.findAllByOrderByNameAsc()
                .stream()
                .map(TaskTypeMapper::toResponse)
                .toList();
    }

    @Transactional
    public TaskTypeResponse create(TaskTypeRequest request) {
        ensureUniqueName(request.name(), null);
        TaskTypeEntity entity = new TaskTypeEntity();
        apply(entity, request);
        return TaskTypeMapper.toResponse(taskTypeRepository.save(entity));
    }

    @Transactional
    public TaskTypeResponse update(Long id, TaskTypeRequest request) {
        TaskTypeEntity entity = taskTypeRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "没有找到对应的任务类型"));
        ensureUniqueName(request.name(), id);
        apply(entity, request);
        return TaskTypeMapper.toResponse(taskTypeRepository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        TaskTypeEntity entity = taskTypeRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "没有找到对应的任务类型"));
        planTaskRepository.clearTaskTypeReferences(id);
        taskTypeRepository.delete(entity);
    }

    private void ensureUniqueName(String name, Long currentId) {
        taskTypeRepository.findByNameIgnoreCase(name.trim())
                .filter(entity -> !entity.getId().equals(currentId))
                .ifPresent(entity -> {
                    throw new ApiException(HttpStatus.CONFLICT, "同名任务类型已经存在");
                });
    }

    private void apply(TaskTypeEntity entity, TaskTypeRequest request) {
        entity.setName(request.name().trim());
        entity.setIconKey(request.iconKey().trim());
        entity.setColorHex(request.colorHex().trim());
        entity.setDescription(request.description() == null ? "" : request.description().trim());
    }
}
