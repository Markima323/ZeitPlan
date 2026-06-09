package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.DailyPlanEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyPlanRepository extends JpaRepository<DailyPlanEntity, Long> {

    @EntityGraph(attributePaths = {"tasks", "tasks.taskType"})
    Optional<DailyPlanEntity> findByPlanDate(LocalDate planDate);

    @EntityGraph(attributePaths = {"tasks", "tasks.taskType"})
    Optional<DailyPlanEntity> findFirstByPlanDateBeforeOrderByPlanDateDesc(LocalDate planDate);

    @EntityGraph(attributePaths = {"tasks", "tasks.taskType"})
    List<DailyPlanEntity> findAllByPlanDateBetweenOrderByPlanDateAsc(LocalDate fromDate, LocalDate toDate);
}
