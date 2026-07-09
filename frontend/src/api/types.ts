export type SeasonMode = "SUMMER" | "WINTER";
export type DicePhase = "MATERIAL" | "PRAISE";

export interface TaskTypePayload {
  name: string;
  iconKey: string;
  colorHex: string;
  description: string;
  focusTask: boolean;
  keywords: string[];
}

export interface TaskTypeResponse extends TaskTypePayload {
  id: number;
  sortOrder: number;
}

export interface PlanTaskResponse {
  id: number | null;
  title: string;
  taskTypeId: number | null;
  durationMinutes: number;
  orderIndex: number;
  taskTypeAutoLocked: boolean;
}

export interface DailyPlanResponse {
  id: number | null;
  planDate: string;
  seasonMode: SeasonMode;
  dayStartLocalTime: string;
  nightPlanEnabled: boolean;
  tasks: PlanTaskResponse[];
}

export interface DailyPlanPayload {
  planDate: string;
  seasonMode: SeasonMode;
  dayStartLocalTime: string;
  nightPlanEnabled: boolean;
  tasks: PlanTaskResponse[];
}

export interface DailyPlanSummary {
  planDate: string;
  seasonMode: SeasonMode;
  taskCount: number;
  focusMinutes: number;
  firstLocalStartTime: string | null;
  lastLocalEndTime: string | null;
  highlightTasks: string[];
}

export interface TaskTypeStat {
  taskTypeId: number | null;
  taskTypeName: string;
  taskTypeIcon: string;
  taskTypeColor: string;
  totalMinutes: number;
}

export interface AdminOverviewResponse {
  fromDate: string;
  toDate: string;
  plannedDays: number;
  focusMinutes: number;
  days: DailyPlanSummary[];
  typeStats: TaskTypeStat[];
}

export interface KindleDevice {
  id: string;
  name: string;
  lastSeenAt: string | null;
  lastWidth: number | null;
  lastHeight: number | null;
  lastBatteryPercentage: number | null;
  lastRssi: string | null;
  currentVersion: number;
  currentScreenTitle: string | null;
  lastRenderStatus: string | null;
  lastErrorMessage: string | null;
  lastPushedAt: string | null;
  enabled: boolean;
  autoPushEnabled: boolean;
}

export interface KindleDevicesResponse {
  devices: KindleDevice[];
}

export interface KindleCreateDeviceResponse {
  device: KindleDevice;
  deviceToken: string;
}

export interface KindleRepushResponse {
  ok: boolean;
  version: number;
  status: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  expiresAt: string;
  cookieDurationDays: number;
}

export interface DiceRollResponse {
  id: number;
  planDate: string;
  phase: DicePhase;
  value: number;
  rewardUnlocked: boolean;
  message: string;
  createdAt: string;
}
