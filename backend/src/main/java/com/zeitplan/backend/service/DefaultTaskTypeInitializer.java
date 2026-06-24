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
                taskType(
                        "\u6df1\u5ea6\u5de5\u4f5c",
                        "code",
                        "#F47B20",
                        "\u9700\u8981\u4e13\u6ce8\u8f93\u51fa\u7684\u4efb\u52a1",
                        true,
                        0,
                        List.of("\u5f00\u53d1", "Programieren", "Programmieren", "\u4fee\u6587", "\u9879\u76ee")
                ),
                taskType(
                        "\u65e5\u5e38\u8fd0\u8425",
                        "work",
                        "#E5983F",
                        "\u4f1a\u8bae\u3001\u6c9f\u901a\u3001\u8ddf\u8fdb\u7b49\u65e5\u5e38\u4e8b\u9879",
                        false,
                        1,
                        List.of(
                                "\u6bcf\u65e5\u8ba1\u5212",
                                "\u6d17\u6fa1",
                                "\u6d17\u8863\u670d",
                                "\u90ae\u4ef6",
                                "Z\u00e4hne putzen",
                                "\u5730\u5740",
                                "\u7eb8\u7bb1",
                                "\u5199\u4fe1",
                                "\u5feb\u9012",
                                "\u9000\u8ba2"
                        )
                ),
                taskType(
                        "\u5b66\u4e60\u8f93\u5165",
                        "study",
                        "#9C6BBA",
                        "\u770b\u8bfe\u7a0b\u3001\u8bfb\u6587\u6863\u3001\u5199\u7b14\u8bb0",
                        true,
                        2,
                        List.of("\u5fb7\u8bed", "\u5b66", "\u7f51\u8bfe")
                ),
                taskType(
                        "\u996e\u98df\u4f11\u6574",
                        "meal",
                        "#D36B52",
                        "\u505a\u996d\u3001\u5403\u996d\u548c\u8865\u7ed9",
                        false,
                        3,
                        List.of("\u5403\u996d", "\u5348\u4f11", "Ausruhen", "Kochen", "Essen", "Schlafen gehen")
                ),
                taskType(
                        "\u8eab\u4f53\u72b6\u6001",
                        "health",
                        "#4E9B7A",
                        "\u6062\u590d\u3001\u62a4\u7406\u548c\u7167\u987e\u8eab\u4f53",
                        false,
                        4,
                        List.of()
                )
        ));
    }

    private TaskTypeEntity taskType(
            String name,
            String iconKey,
            String colorHex,
            String description,
            boolean focusTask,
            int sortOrder,
            List<String> keywords
    ) {
        TaskTypeEntity entity = new TaskTypeEntity();
        entity.setName(name);
        entity.setIconKey(iconKey);
        entity.setColorHex(colorHex);
        entity.setDescription(description);
        entity.setFocusTask(focusTask);
        entity.setSortOrder(sortOrder);
        entity.setKeywords(keywords);
        return entity;
    }
}
