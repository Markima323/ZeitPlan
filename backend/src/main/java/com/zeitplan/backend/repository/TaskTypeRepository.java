package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.TaskTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskTypeRepository extends JpaRepository<TaskTypeEntity, Long> {

    List<TaskTypeEntity> findAllByOrderBySortOrderAscIdAsc();

    TaskTypeEntity findTopByOrderBySortOrderDescIdDesc();

    Optional<TaskTypeEntity> findByNameIgnoreCase(String name);
}
