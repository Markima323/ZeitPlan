package com.zeitplan.backend.service;

import com.zeitplan.backend.dto.DiceRollRequest;
import com.zeitplan.backend.dto.DiceRollResponse;
import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.DicePhase;
import com.zeitplan.backend.entity.DiceRollEntity;
import com.zeitplan.backend.repository.DailyPlanRepository;
import com.zeitplan.backend.repository.DiceRollRepository;
import com.zeitplan.backend.service.mapper.PlanMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class DiceRollService {

    private final DailyPlanRepository dailyPlanRepository;
    private final DiceRollRepository diceRollRepository;
    private final ZoneId rollZone;
    private final boolean testMode;

    public DiceRollService(
            DailyPlanRepository dailyPlanRepository,
            DiceRollRepository diceRollRepository,
            @Value("${app.dice.roll-zone}") String rollZone,
            @Value("${app.dice.test-mode}") boolean testMode
    ) {
        this.dailyPlanRepository = dailyPlanRepository;
        this.diceRollRepository = diceRollRepository;
        this.rollZone = ZoneId.of(rollZone);
        this.testMode = testMode;
    }

    @Transactional(readOnly = true)
    public List<DiceRollResponse> getHistory(LocalDate planDate) {
        return diceRollRepository.findByPlan_PlanDateOrderByCreatedAtAsc(planDate)
                .stream()
                .map(PlanMapper::toDiceResponse)
                .toList();
    }

    @Transactional
    public DiceRollResponse roll(LocalDate planDate, DiceRollRequest request) {
        DailyPlanEntity plan = dailyPlanRepository.findByPlanDate(planDate)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "这一天还没有保存每日计划"));

        if (plan.getTasks().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "这一天还没有任务，不能投骰子");
        }

        if (!testMode) {
            LocalDate today = LocalDate.now(rollZone);
            LocalTime now = LocalTime.now(rollZone);
            if (!planDate.equals(today) || now.isBefore(LocalTime.of(17, 0))) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "只有当天 17:00 之后才能进行投骰子");
            }
        }

        List<DiceRollEntity> history = diceRollRepository.findByPlan_PlanDateOrderByCreatedAtAsc(planDate);
        if (history.size() >= 2) {
            throw new ApiException(HttpStatus.CONFLICT, "当天两次投掷已经全部使用完");
        }

        DicePhase expectedPhase = history.isEmpty() ? DicePhase.MATERIAL : DicePhase.PRAISE;
        if (request.phase() != expectedPhase) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前投掷阶段不正确");
        }

        int value = ThreadLocalRandom.current().nextInt(1, 7);
        boolean unlocked = value >= 4;

        DiceRollEntity entity = new DiceRollEntity();
        entity.setPlan(plan);
        entity.setPhase(expectedPhase);
        entity.setValue(value);
        entity.setRewardUnlocked(unlocked);
        entity.setMessage(buildMessage(expectedPhase, unlocked, value));

        return PlanMapper.toDiceResponse(diceRollRepository.save(entity));
    }

    private String buildMessage(DicePhase phase, boolean unlocked, int value) {
        if (phase == DicePhase.MATERIAL) {
            return unlocked
                    ? "掷出 " + value + " 点，今晚可以给自己一个小小的物质奖励。"
                    : "掷出 " + value + " 点，这次没有物质奖励，但今天的完成度依然值得肯定。";
        }

        return unlocked
                ? "掷出 " + value + " 点，解锁一条认真夸夸自己的话。"
                : "掷出 " + value + " 点，这次没有夸夸加成，不过你已经把今天过得很扎实了。";
    }
}
