import type { PlanTaskResponse, SeasonMode, TaskTypeResponse } from "../api/types";

export const BREAK_MINUTES = 5;
export const MIN_SLOT_DURATION_MINUTES = 10;
export const MAX_SLOT_DURATION_MINUTES = 1440;
export const MIDDAY_SKIPPED_BREAK_START_MINUTES = (11 * 60) + 55;
export const NOON_SKIPPED_BREAK_START_MINUTES = 12 * 60;
export const SKIPPED_BREAK_START_MINUTES = 14 * 60;
export const EVENING_PLAN_START_MINUTES = 17 * 60;
export const EVENING_PLAN_END_MINUTES = 3 * 60;

export interface ScheduleBlock {
  id: string;
  title: string;
  typeName: string;
  typeIcon: string;
  typeColor: string;
  taskOrderIndex: number | null;
  durationMinutes: number;
  localStartTime: string;
  localEndTime: string;
  beijingStartTime: string;
  beijingEndTime: string;
  editable: boolean;
  breakBlock: boolean;
}

export interface TaskTimelineEntry {
  orderIndex: number;
  slotStartMinutes: number;
  taskStartMinutes: number;
  taskEndMinutes: number;
  slotDurationMinutes: number;
  focusMinutes: number;
  breakMinutesBefore: number;
  hasBreakBefore: boolean;
}

export function shouldIncludeNightPlanContent(nightPlanEnabled: boolean, startMinutes: number) {
  return nightPlanEnabled || !isWithinNightPlan(startMinutes);
}

export function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toClock(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseClock(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60) + minutes;
}

export function isWithinNightPlan(minutes: number) {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  return (
    normalizedMinutes >= EVENING_PLAN_START_MINUTES ||
    normalizedMinutes < EVENING_PLAN_END_MINUTES
  );
}

export function getAutomaticBreakMinutes(taskIndex: number, boundaryMinutes: number) {
  if (taskIndex === 0) {
    return 0;
  }

  const normalizedBoundary = ((boundaryMinutes % 1440) + 1440) % 1440;
  if (
    normalizedBoundary === MIDDAY_SKIPPED_BREAK_START_MINUTES ||
    normalizedBoundary === NOON_SKIPPED_BREAK_START_MINUTES ||
    normalizedBoundary === SKIPPED_BREAK_START_MINUTES ||
    isWithinNightPlan(normalizedBoundary)
  ) {
    return 0;
  }

  return BREAK_MINUTES;
}

export function resolveClockAtOrAfter(anchorMinutes: number, value: string) {
  let minutes = parseClock(value);
  while (minutes <= anchorMinutes) {
    minutes += 1440;
  }
  return minutes;
}

export function normalizeSlotDuration(minutes: number) {
  if (!Number.isFinite(minutes)) {
    return MIN_SLOT_DURATION_MINUTES;
  }

  const rounded = Math.round(minutes / 5) * 5;
  return Math.min(MAX_SLOT_DURATION_MINUTES, Math.max(MIN_SLOT_DURATION_MINUTES, rounded));
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}小时${minutes}分钟`;
  }

  if (hours) {
    return `${hours}小时`;
  }

  return `${minutes}分钟`;
}

export function buildScheduleBlocks(
  tasks: PlanTaskResponse[],
  taskTypes: TaskTypeResponse[],
  dayStartLocalTime: string,
  seasonMode: SeasonMode,
  nightPlanEnabled = true,
) {
  const offsetMinutes = seasonMode === "SUMMER" ? 360 : 420;
  const taskTypeMap = new Map(taskTypes.map((item) => [item.id, item]));
  const sortedTasks = [...tasks].sort((left, right) => left.orderIndex - right.orderIndex);
  const timeline = buildTaskTimeline(sortedTasks, dayStartLocalTime);

  const blocks: ScheduleBlock[] = [];

  sortedTasks.forEach((task, index) => {
      const timelineEntry = timeline[index];
      const taskType = task.taskTypeId ? taskTypeMap.get(task.taskTypeId) : undefined;

      if (timelineEntry.hasBreakBefore) {
        const breakStart = timelineEntry.slotStartMinutes;
        const breakEnd = timelineEntry.taskStartMinutes;
        blocks.push({
          id: `break-${index}`,
          title: "休息 5 分钟",
          typeName: "系统休息",
          typeIcon: "coffee",
          typeColor: "#F8E6D2",
          taskOrderIndex: null,
          durationMinutes: timelineEntry.breakMinutesBefore,
          localStartTime: toClock(breakStart),
          localEndTime: toClock(breakEnd),
          beijingStartTime: toClock(breakStart + offsetMinutes),
          beijingEndTime: toClock(breakEnd + offsetMinutes),
          editable: false,
          breakBlock: true,
        });
      }

      blocks.push({
        id: `task-${task.id ?? index}`,
        title: task.title || "未命名任务",
        typeName: taskType?.name ?? "未分类",
        typeIcon: taskType?.iconKey ?? "sparkles",
        typeColor: taskType?.colorHex ?? "#F47B20",
        taskOrderIndex: task.orderIndex,
        durationMinutes: timelineEntry.focusMinutes,
        localStartTime: toClock(timelineEntry.taskStartMinutes),
        localEndTime: toClock(timelineEntry.taskEndMinutes),
        beijingStartTime: toClock(timelineEntry.taskStartMinutes + offsetMinutes),
        beijingEndTime: toClock(timelineEntry.taskEndMinutes + offsetMinutes),
        editable: true,
        breakBlock: false,
      });
    });

  return {
    blocks,
    focusMinutes: sortedTasks.reduce((sum, task, index) => {
      const taskType = task.taskTypeId ? taskTypeMap.get(task.taskTypeId) : undefined;
      return sum + (
        taskType?.focusTask && shouldIncludeNightPlanContent(nightPlanEnabled, timeline[index].taskStartMinutes)
          ? timeline[index].focusMinutes
          : 0
      );
    }, 0),
    breakMinutes: timeline.reduce((sum, item) => (
      shouldIncludeNightPlanContent(nightPlanEnabled, item.slotStartMinutes)
        ? sum + item.breakMinutesBefore
        : sum
    ), 0),
  };
}

export function buildTaskTimeline(tasks: PlanTaskResponse[], dayStartLocalTime: string) {
  let cursor = parseClock(dayStartLocalTime);

  return [...tasks]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((task, index) => {
      const slotDurationMinutes = normalizeSlotDuration(task.durationMinutes);
      const breakMinutesBefore = getAutomaticBreakMinutes(index, cursor);
      const hasBreakBefore = breakMinutesBefore > 0;
      const taskStartMinutes = cursor + breakMinutesBefore;
      const taskEndMinutes = cursor + slotDurationMinutes;
      const focusMinutes = Math.max(taskEndMinutes - taskStartMinutes, 0);

      const entry: TaskTimelineEntry = {
        orderIndex: index,
        slotStartMinutes: cursor,
        taskStartMinutes,
        taskEndMinutes,
        slotDurationMinutes,
        focusMinutes,
        breakMinutesBefore,
        hasBreakBefore,
      };

      cursor = taskEndMinutes;
      return entry;
    });
}
