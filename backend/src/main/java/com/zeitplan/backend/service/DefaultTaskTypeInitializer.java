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
                taskType("深度工作", "code", "#F47B20", "需要专注输出的任务"),
                taskType("日常运营", "work", "#E5983F", "会议、沟通、跟进等日常事项"),
                taskType("学习输入", "study", "#9C6BBA", "看课程、读文档、写笔记"),
                taskType("饮食休整", "meal", "#D36B52", "做饭、吃饭和补给"),
                taskType("身体状态", "health", "#4E9B7A", "恢复、护理和照顾身体")
        ));
    }

    private TaskTypeEntity taskType(String name, String iconKey, String colorHex, String description) {
        TaskTypeEntity entity = new TaskTypeEntity();
        entity.setName(name);
        entity.setIconKey(iconKey);
        entity.setColorHex(colorHex);
        entity.setDescription(description);
        return entity;
    }
}
