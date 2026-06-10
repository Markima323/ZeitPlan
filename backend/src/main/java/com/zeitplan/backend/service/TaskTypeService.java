package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.TaskTypeOrderRequest;
import com.zeitplan.backend.dto.TaskTypeRequest;
import com.zeitplan.backend.dto.TaskTypeResponse;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.PlanTaskRepository;
import com.zeitplan.backend.repository.TaskTypeRepository;
import com.zeitplan.backend.service.mapper.TaskTypeMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

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
        return taskTypeRepository.findAllByOrderBySortOrderAscIdAsc()
                .stream()
                .map(TaskTypeMapper::toResponse)
                .toList();
    }

    @Transactional
    public TaskTypeResponse create(TaskTypeRequest request) {
        ensureUniqueName(request.name(), null);
        TaskTypeEntity entity = new TaskTypeEntity();
        entity.setSortOrder(resolveNextSortOrder());
        apply(entity, request);
        return TaskTypeMapper.toResponse(taskTypeRepository.save(entity));
    }

    @Transactional
    public TaskTypeResponse update(Long id, TaskTypeRequest request) {
        TaskTypeEntity entity = taskTypeRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "\u6ca1\u6709\u627e\u5230\u5bf9\u5e94\u7684\u4efb\u52a1\u7c7b\u578b"));
        ensureUniqueName(request.name(), id);
        apply(entity, request);
        return TaskTypeMapper.toResponse(taskTypeRepository.save(entity));
    }

    @Transactional
    public List<TaskTypeResponse> reorder(TaskTypeOrderRequest request) {
        List<TaskTypeEntity> entities = taskTypeRepository.findAllByOrderBySortOrderAscIdAsc();
        List<Long> requestedIds = request.taskTypeIds();

        if (!hasMatchingIds(entities, requestedIds)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "\u4efb\u52a1\u7c7b\u578b\u987a\u5e8f\u8bf7\u6c42\u4e0d\u5b8c\u6574\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5");
        }

        Map<Long, TaskTypeEntity> entityById = entities.stream()
                .collect(Collectors.toMap(TaskTypeEntity::getId, Function.identity()));

        for (int index = 0; index < requestedIds.size(); index++) {
            entityById.get(requestedIds.get(index)).setSortOrder(index);
        }

        return taskTypeRepository.saveAll(entities).stream()
                .sorted((left, right) -> {
                    int orderComparison = Integer.compare(left.getSortOrder(), right.getSortOrder());
                    if (orderComparison != 0) {
                        return orderComparison;
                    }
                    return left.getId().compareTo(right.getId());
                })
                .map(TaskTypeMapper::toResponse)
                .toList();
    }

    @Transactional
    public void delete(Long id) {
        TaskTypeEntity entity = taskTypeRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "\u6ca1\u6709\u627e\u5230\u5bf9\u5e94\u7684\u4efb\u52a1\u7c7b\u578b"));
        planTaskRepository.clearTaskTypeReferences(id);
        taskTypeRepository.delete(entity);
        normalizeSortOrder();
    }

    private void ensureUniqueName(String name, Long currentId) {
        taskTypeRepository.findByNameIgnoreCase(name.trim())
                .filter(entity -> !entity.getId().equals(currentId))
                .ifPresent(entity -> {
                    throw new ApiException(HttpStatus.CONFLICT, "\u540c\u540d\u4efb\u52a1\u7c7b\u578b\u5df2\u7ecf\u5b58\u5728");
                });
    }

    private void apply(TaskTypeEntity entity, TaskTypeRequest request) {
        entity.setName(request.name().trim());
        entity.setIconKey(request.iconKey().trim());
        entity.setColorHex(request.colorHex().trim());
        entity.setDescription(request.description() == null ? "" : request.description().trim());
        entity.setFocusTask(request.focusTask());
    }

    private int resolveNextSortOrder() {
        if (taskTypeRepository.count() == 0) {
            return 0;
        }
        return taskTypeRepository.findTopByOrderBySortOrderDescIdDesc().getSortOrder() + 1;
    }

    private boolean hasMatchingIds(List<TaskTypeEntity> entities, List<Long> requestedIds) {
        if (entities.size() != requestedIds.size()) {
            return false;
        }

        return entities.stream().map(TaskTypeEntity::getId).collect(Collectors.toSet())
                .equals(new HashSet<>(requestedIds));
    }

    private void normalizeSortOrder() {
        List<TaskTypeEntity> entities = taskTypeRepository.findAllByOrderBySortOrderAscIdAsc();
        boolean changed = false;

        for (int index = 0; index < entities.size(); index++) {
            TaskTypeEntity entity = entities.get(index);
            if (entity.getSortOrder() != index) {
                entity.setSortOrder(index);
                changed = true;
            }
        }

        if (changed) {
            taskTypeRepository.saveAll(entities);
        }
    }
}
