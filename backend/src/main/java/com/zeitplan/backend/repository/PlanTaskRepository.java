package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.PlanTaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlanTaskRepository extends JpaRepository<PlanTaskEntity, Long> {

    @Modifying
    @Query("update PlanTaskEntity task set task.taskType = null where task.taskType.id = :taskTypeId")
    int clearTaskTypeReferences(@Param("taskTypeId") Long taskTypeId);
}
