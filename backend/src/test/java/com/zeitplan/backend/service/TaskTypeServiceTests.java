package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.TaskTypeOrderRequest;
import com.zeitplan.backend.dto.TaskTypeKeywordsRequest;
import com.zeitplan.backend.dto.TaskTypeRequest;
import com.zeitplan.backend.dto.TaskTypeResponse;
import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.TaskTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class TaskTypeServiceTests {

    @Autowired
    private TaskTypeService taskTypeService;

    @Autowired
    private TaskTypeRepository taskTypeRepository;

    @BeforeEach
    void setUp() {
        taskTypeRepository.deleteAll();
    }

    @Test
    void getAllReturnsTypesBySortOrder() {
        taskTypeRepository.saveAll(List.of(
                taskType("gamma", 2),
                taskType("alpha", 0),
                taskType("beta", 1)
        ));

        List<TaskTypeResponse> types = taskTypeService.getAll();

        assertThat(types)
                .extracting(TaskTypeResponse::name)
                .containsExactly("alpha", "beta", "gamma");
    }

    @Test
    void reorderPersistsNewTypeOrder() {
        TaskTypeEntity first = taskTypeRepository.save(taskType("alpha", 0));
        TaskTypeEntity second = taskTypeRepository.save(taskType("beta", 1));
        TaskTypeEntity third = taskTypeRepository.save(taskType("gamma", 2));

        List<TaskTypeResponse> reorderedTypes = taskTypeService.reorder(
                new TaskTypeOrderRequest(List.of(third.getId(), first.getId(), second.getId()))
        );

        assertThat(reorderedTypes)
                .extracting(TaskTypeResponse::id)
                .containsExactly(third.getId(), first.getId(), second.getId());

        assertThat(taskTypeRepository.findAllByOrderBySortOrderAscIdAsc())
                .extracting(TaskTypeEntity::getId)
                .containsExactly(third.getId(), first.getId(), second.getId());
    }

    @Test
    void createAppendsNewTypeToEnd() {
        taskTypeRepository.save(taskType("alpha", 0));
        taskTypeRepository.save(taskType("beta", 1));

        TaskTypeResponse createdType = taskTypeService.create(
                new TaskTypeRequest("gamma", "study", "#123456", "notes", true, List.of("Study", " study "))
        );

        assertThat(createdType.sortOrder()).isEqualTo(2);
        assertThat(createdType.keywords()).containsExactly("Study");
    }

    @Test
    void updateKeywordsRejectsKeywordOwnedByAnotherType() {
        TaskTypeEntity first = taskTypeRepository.save(taskType("alpha", 0));
        first.setKeywords(List.of("shared"));
        taskTypeRepository.save(first);
        TaskTypeEntity second = taskTypeRepository.save(taskType("beta", 1));

        assertThatThrownBy(() ->
                taskTypeService.updateKeywords(
                        second.getId(),
                        new TaskTypeKeywordsRequest(List.of("SHARED"))
                )
        ).hasMessageContaining("SHARED");
    }

    private TaskTypeEntity taskType(String name, int sortOrder) {
        TaskTypeEntity entity = new TaskTypeEntity();
        entity.setName(name);
        entity.setIconKey("sparkles");
        entity.setColorHex("#123456");
        entity.setDescription(name + " description");
        entity.setFocusTask(true);
        entity.setSortOrder(sortOrder);
        return entity;
    }
}
