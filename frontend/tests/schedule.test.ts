import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlanTaskResponse, TaskTypeResponse } from "../src/api/types.ts";
import {
  buildScheduleBlocks,
  getAutomaticBreakMinutes,
  getIncludedPlanMinutes,
  getNightPlanStartMinutes,
  getPlanPreviewBlocks,
} from "../src/lib/schedule.ts";

const focusType: TaskTypeResponse = {
  id: 1, name: "Focus", iconKey: "code", colorHex: "#123456", description: "",
  focusTask: true, sortOrder: 0, keywords: [],
};

function task(durationMinutes: number, orderIndex = 0): PlanTaskResponse {
  return { id: null, title: "Task", taskTypeId: 1, durationMinutes, orderIndex, taskTypeAutoLocked: false };
}

test("seasonal defaults follow summer and winter while custom splits take priority", () => {
  assert.equal(getNightPlanStartMinutes("SUMMER"), 17 * 60);
  assert.equal(getNightPlanStartMinutes("WINTER"), 16 * 60);
  assert.equal(getNightPlanStartMinutes("WINTER", "18:30:00"), 18 * 60 + 30);
});

test("winter and custom night tasks no longer receive automatic breaks", () => {
  assert.equal(getAutomaticBreakMinutes(1, 16 * 60, getNightPlanStartMinutes("WINTER")), 0);
  assert.equal(getAutomaticBreakMinutes(1, 16 * 60, getNightPlanStartMinutes("SUMMER")), 5);
  assert.equal(getAutomaticBreakMinutes(1, 18 * 60 + 30, getNightPlanStartMinutes("SUMMER", "18:30")), 0);
  assert.equal(getAutomaticBreakMinutes(1, 11 * 60 + 55, 16 * 60), 0);
  assert.equal(getAutomaticBreakMinutes(1, 12 * 60, 16 * 60), 0);
  assert.equal(getAutomaticBreakMinutes(1, 14 * 60, 16 * 60), 0);
});

test("winter split controls previews, Beijing times, and focus statistics together", () => {
  const schedule = buildScheduleBlocks([task(60), task(60, 1)], [focusType], "15:00", "WINTER", false);
  assert.equal(schedule.focusMinutes, 60);
  assert.equal(schedule.blocks.length, 2);
  const day = getPlanPreviewBlocks(schedule.blocks, 6 * 60, 16 * 60);
  const night = getPlanPreviewBlocks(schedule.blocks, 16 * 60, 3 * 60);
  assert.equal(day.length, 1);
  assert.equal(day[0].localEndTime, "16:00");
  assert.equal(day[0].beijingEndTime, "23:00");
  assert.equal(night.length, 1);
  assert.equal(night[0].localStartTime, "16:00");
});

test("custom split clips crossing tasks into both previews without dropping content", () => {
  const schedule = buildScheduleBlocks([task(90)], [focusType], "16:00", "SUMMER", false, "16:30");
  const day = getPlanPreviewBlocks(schedule.blocks, 6 * 60, 16 * 60 + 30);
  const night = getPlanPreviewBlocks(schedule.blocks, 16 * 60 + 30, 3 * 60);
  assert.equal(schedule.focusMinutes, 30);
  assert.equal(day[0].localStartTime, "16:00");
  assert.equal(day[0].localEndTime, "16:30");
  assert.equal(day[0].beijingEndTime, "22:30");
  assert.equal(night[0].localStartTime, "16:30");
  assert.equal(night[0].localEndTime, "17:30");
  assert.equal(night[0].taskOrderIndex, day[0].taskOrderIndex);
  assert.equal(day[0].durationMinutes + night[0].durationMinutes, 90);
});

test("night preview handles midnight and stops at 03:00", () => {
  const schedule = buildScheduleBlocks([task(300), task(120, 1)], [focusType], "22:00", "WINTER");
  const night = getPlanPreviewBlocks(schedule.blocks, 16 * 60, 3 * 60);
  assert.equal(night.length, 1);
  assert.equal(night[0].localStartTime, "22:00");
  assert.equal(night[0].localEndTime, "03:00");
  assert.equal(night[0].beijingStartTime, "05:00");
  assert.equal(night[0].beijingEndTime, "10:00");
});

test("after-midnight tasks appear in the night preview and daytime statistics clip correctly", () => {
  const schedule = buildScheduleBlocks([task(60)], [focusType], "01:00", "WINTER");
  const night = getPlanPreviewBlocks(schedule.blocks, 16 * 60, 3 * 60);
  assert.equal(night.length, 1);
  assert.equal(night[0].localStartTime, "01:00");
  assert.equal(getIncludedPlanMinutes(23 * 60, 300, false, 16 * 60), 60);
  assert.equal(getIncludedPlanMinutes(15 * 60 + 30, 90, false, 16 * 60), 30);
  assert.equal(getIncludedPlanMinutes(16 * 60, 60, true, 16 * 60), 60);
});

test("a split at the day preview start produces an empty day preview", () => {
  const schedule = buildScheduleBlocks([task(60)], [focusType], "10:00", "WINTER", true, "06:00");
  assert.deepEqual(getPlanPreviewBlocks(schedule.blocks, 6 * 60, 6 * 60), []);
});
