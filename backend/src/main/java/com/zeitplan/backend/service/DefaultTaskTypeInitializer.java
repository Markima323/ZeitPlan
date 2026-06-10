package com.zeitplan.backend.service;

import com.zeitplan.backend.entity.TaskTypeEntity;
import com.zeitplan.backend.repository.TaskTypeRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DefaultTaskTypeInitializer implements ApplicationRunner {

    private final TaskTypeRepository taskTypeRepository;

    public DefaultTaskTypeInitializer(TaskTypeRepository taskTypeRepository) {
        this.taskTypeRepository = taskTypeRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (taskTypeRepository.count() > 0) {
            return;
        }

        taskTypeRepository.saveAll(List.of(
                taskType("\u6df1\u5ea6\u5de5\u4f5c", "code", "#F47B20", "\u9700\u8981\u4e13\u6ce8\u8f93\u51fa\u7684\u4efb\u52a1", true, 0),
                taskType("\u65e5\u5e38\u8fd0\u8425", "work", "#E5983F", "\u4f1a\u8bae\u3001\u6c9f\u901a\u3001\u8ddf\u8fdb\u7b49\u65e5\u5e38\u4e8b\u9879", false, 1),
                taskType("\u5b66\u4e60\u8f93\u5165", "study", "#9C6BBA", "\u770b\u8bfe\u7a0b\u3001\u8bfb\u6587\u6863\u3001\u5199\u7b14\u8bb0", true, 2),
                taskType("\u996e\u98df\u4f11\u6574", "meal", "#D36B52", "\u505a\u996d\u3001\u5403\u996d\u548c\u8865\u7ed9", false, 3),
                taskType("\u8eab\u4f53\u72b6\u6001", "health", "#4E9B7A", "\u6062\u590d\u3001\u62a4\u7406\u548c\u7167\u987e\u8eab\u4f53", false, 4)
        ));
    }

    private TaskTypeEntity taskType(
            String name,
            String iconKey,
            String colorHex,
            String description,
            boolean focusTask,
            int sortOrder
    ) {
        TaskTypeEntity entity = new TaskTypeEntity();
        entity.setName(name);
        entity.setIconKey(iconKey);
        entity.setColorHex(colorHex);
        entity.setDescription(description);
        entity.setFocusTask(focusTask);
        entity.setSortOrder(sortOrder);
        return entity;
    }
}
