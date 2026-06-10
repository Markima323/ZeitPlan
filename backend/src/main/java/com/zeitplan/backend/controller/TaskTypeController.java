package com.zeitplan.backend.controller;

import com.zeitplan.backend.dto.TaskTypeOrderRequest;
import com.zeitplan.backend.dto.TaskTypeRequest;
import com.zeitplan.backend.dto.TaskTypeResponse;
import com.zeitplan.backend.service.TaskTypeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.NO_CONTENT;

@RestController
@RequestMapping("/api/task-types")
public class TaskTypeController {

    private final TaskTypeService taskTypeService;

    public TaskTypeController(TaskTypeService taskTypeService) {
        this.taskTypeService = taskTypeService;
    }

    @GetMapping
    public List<TaskTypeResponse> getAll() {
        return taskTypeService.getAll();
    }

    @PostMapping
    @ResponseStatus(CREATED)
    public TaskTypeResponse create(@Valid @RequestBody TaskTypeRequest request) {
        return taskTypeService.create(request);
    }

    @PutMapping("/{id}")
    public TaskTypeResponse update(@PathVariable Long id, @Valid @RequestBody TaskTypeRequest request) {
        return taskTypeService.update(id, request);
    }

    @PutMapping("/order")
    public List<TaskTypeResponse> reorder(@Valid @RequestBody TaskTypeOrderRequest request) {
        return taskTypeService.reorder(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(NO_CONTENT)
    public void delete(@PathVariable Long id) {
        taskTypeService.delete(id);
    }
}
