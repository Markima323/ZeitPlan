package com.zeitplan.backend.controller;

import com.zeitplan.backend.dto.DailyPlanRequest;
import com.zeitplan.backend.dto.DailyPlanResponse;
import com.zeitplan.backend.dto.DiceRollRequest;
import com.zeitplan.backend.dto.DiceRollResponse;
import com.zeitplan.backend.service.DailyPlanService;
import com.zeitplan.backend.service.DiceRollService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/plans")
public class DailyPlanController {

    private final DailyPlanService dailyPlanService;
    private final DiceRollService diceRollService;

    public DailyPlanController(DailyPlanService dailyPlanService, DiceRollService diceRollService) {
        this.dailyPlanService = dailyPlanService;
        this.diceRollService = diceRollService;
    }

    @GetMapping("/latest")
    public ResponseEntity<DailyPlanResponse> getLatestPlanBefore(@RequestParam("before") LocalDate beforeDate) {
        return dailyPlanService.getLatestPlanBefore(beforeDate)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{planDate}")
    public DailyPlanResponse getPlan(@PathVariable LocalDate planDate) {
        return dailyPlanService.getPlan(planDate);
    }

    @PutMapping("/{planDate}")
    public DailyPlanResponse savePlan(@PathVariable LocalDate planDate, @Valid @RequestBody DailyPlanRequest request) {
        return dailyPlanService.savePlan(planDate, request);
    }

    @GetMapping("/{planDate}/dice-rolls")
    public List<DiceRollResponse> getDiceHistory(@PathVariable LocalDate planDate) {
        return diceRollService.getHistory(planDate);
    }

    @PostMapping("/{planDate}/dice-rolls")
    public DiceRollResponse rollDice(@PathVariable LocalDate planDate, @Valid @RequestBody DiceRollRequest request) {
        return diceRollService.roll(planDate, request);
    }
}
