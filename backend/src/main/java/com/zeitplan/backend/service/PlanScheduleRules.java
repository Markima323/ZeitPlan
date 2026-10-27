package com.zeitplan.backend.service;

import com.zeitplan.backend.entity.DailyPlanEntity;
import com.zeitplan.backend.entity.SeasonMode;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public final class PlanScheduleRules {

    private static final int MINUTES_PER_DAY = 1440;
    private static final int NIGHT_END_MINUTES = 3 * 60;

    private PlanScheduleRules() {
    }

    public static int nightStartMinutes(DailyPlanEntity plan) {
        LocalTime customTime = plan.getNightStartLocalTime();
        return customTime == null
                ? (plan.getSeasonMode() == SeasonMode.WINTER ? 16 : 17) * 60
                : customTime.getHour() * 60 + customTime.getMinute();
    }

    public static boolean isWithinNightPlan(int minutes, int nightStartMinutes) {
        int normalized = Math.floorMod(minutes, MINUTES_PER_DAY);
        return normalized >= nightStartMinutes || normalized < NIGHT_END_MINUTES;
    }

    public static int automaticBreakMinutes(int taskIndex, int boundaryMinutes, int nightStartMinutes) {
        int normalized = Math.floorMod(boundaryMinutes, MINUTES_PER_DAY);
        if (taskIndex == 0 || normalized == 11 * 60 + 55 || normalized == 12 * 60
                || normalized == 14 * 60 || isWithinNightPlan(normalized, nightStartMinutes)) {
            return 0;
        }
        return 5;
    }

    public static List<TimeRange> includedRanges(int startMinutes, int durationMinutes, boolean nightEnabled, int nightStartMinutes) {
        if (nightEnabled) {
            return List.of(new TimeRange(startMinutes, startMinutes + durationMinutes));
        }

        // A task can straddle the split or midnight; count only its daytime portions.
        int endMinutes = startMinutes + durationMinutes;
        List<TimeRange> ranges = new ArrayList<>();
        for (int day = Math.floorDiv(startMinutes, MINUTES_PER_DAY);
                day <= Math.floorDiv(endMinutes, MINUTES_PER_DAY); day++) {
            int dayStart = day * MINUTES_PER_DAY;
            int start = Math.max(startMinutes, dayStart + NIGHT_END_MINUTES);
            int end = Math.min(endMinutes, dayStart + nightStartMinutes);
            if (start < end) {
                ranges.add(new TimeRange(start, end));
            }
        }
        return ranges;
    }

    public record TimeRange(int startMinutes, int endMinutes) {
    }
}
