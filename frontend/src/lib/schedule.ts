import type { PlanTaskResponse, SeasonMode, TaskTypeResponse } from "../api/types";

export interface ScheduleBlock {
  id: string;
  title: string;
  typeName: string;
  typeIcon: string;
  typeColor: string;
  durationMinutes: number;
  localStartTime: string;
  localEndTime: string;
  beijingStartTime: string;
  beijingEndTime: string;
  editable: boolean;
  breakBlock: boolean;
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
) {
  const offsetMinutes = seasonMode === "SUMMER" ? 360 : 420;
  const taskTypeMap = new Map(taskTypes.map((item) => [item.id, item]));
  let cursor = parseClock(dayStartLocalTime);

  const blocks: ScheduleBlock[] = [];

  [...tasks]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .forEach((task, index) => {
      const taskType = task.taskTypeId ? taskTypeMap.get(task.taskTypeId) : undefined;
      const localStart = cursor;
      const localEnd = cursor + task.durationMinutes;

      blocks.push({
        id: `task-${task.id ?? index}`,
        title: task.title || "未命名任务",
        typeName: taskType?.name ?? "未分类",
        typeIcon: taskType?.iconKey ?? "sparkles",
        typeColor: taskType?.colorHex ?? "#F47B20",
        durationMinutes: task.durationMinutes,
        localStartTime: toClock(localStart),
        localEndTime: toClock(localEnd),
        beijingStartTime: toClock(localStart + offsetMinutes),
        beijingEndTime: toClock(localEnd + offsetMinutes),
        editable: true,
        breakBlock: false,
      });

      cursor = localEnd;

      if (index < tasks.length - 1) {
        const breakStart = cursor;
        const breakEnd = cursor + 5;
        blocks.push({
          id: `break-${index}`,
          title: "休息 5 分钟",
          typeName: "系统休息",
          typeIcon: "coffee",
          typeColor: "#F8E6D2",
          durationMinutes: 5,
          localStartTime: toClock(breakStart),
          localEndTime: toClock(breakEnd),
          beijingStartTime: toClock(breakStart + offsetMinutes),
          beijingEndTime: toClock(breakEnd + offsetMinutes),
          editable: false,
          breakBlock: true,
        });
        cursor = breakEnd;
      }
    });

  return {
    blocks,
    focusMinutes: tasks.reduce((sum, item) => sum + item.durationMinutes, 0),
    breakMinutes: tasks.length > 1 ? (tasks.length - 1) * 5 : 0,
  };
}
