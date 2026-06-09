package com.zeitplan.backend.repository;

import com.zeitplan.backend.entity.DiceRollEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DiceRollRepository extends JpaRepository<DiceRollEntity, Long> {

    List<DiceRollEntity> findByPlan_PlanDateOrderByCreatedAtAsc(LocalDate planDate);
}
