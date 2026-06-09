package com.zeitplan.backend.controller;

import com.zeitplan.backend.dto.AdminOverviewResponse;
import com.zeitplan.backend.service.AdminOverviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminOverviewService adminOverviewService;

    public AdminController(AdminOverviewService adminOverviewService) {
        this.adminOverviewService = adminOverviewService;
    }

    @GetMapping("/overview")
    public AdminOverviewResponse getOverview(
            @RequestParam("from") LocalDate fromDate,
            @RequestParam("to") LocalDate toDate
    ) {
        return adminOverviewService.getOverview(fromDate, toDate);
    }
}
