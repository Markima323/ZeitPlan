export interface TaskIconChoice {
  key: string;
  label: string;
  colorHex: string;
}

export const TASK_ICON_CHOICES: TaskIconChoice[] = [
  { key: "sparkles", label: "灵感", colorHex: "#F47B20" },
  { key: "calendar", label: "日程", colorHex: "#D97706" },
  { key: "code", label: "开发", colorHex: "#2563EB" },
  { key: "work", label: "工作", colorHex: "#7C3AED" },
  { key: "study", label: "学习", colorHex: "#0F766E" },
  { key: "meal", label: "饮食", colorHex: "#DC2626" },
  { key: "health", label: "健康", colorHex: "#EA580C" },
  { key: "fitness", label: "运动", colorHex: "#16A34A" },
  { key: "social", label: "沟通", colorHex: "#EC4899" },
  { key: "travel", label: "出行", colorHex: "#0284C7" },
  { key: "rest", label: "休息", colorHex: "#6366F1" },
  { key: "coffee", label: "咖啡", colorHex: "#92400E" },
  { key: "brain", label: "思考", colorHex: "#9333EA" },
  { key: "home", label: "家务", colorHex: "#14B8A6" },
  { key: "shopping", label: "采购", colorHex: "#DB2777" },
  { key: "gamepad", label: "娱乐", colorHex: "#8B5CF6" },
  { key: "headphones", label: "听课", colorHex: "#0EA5E9" },
  { key: "camera", label: "拍摄", colorHex: "#F43F5E" },
  { key: "mic", label: "录音", colorHex: "#EF4444" },
  { key: "notebook", label: "记录", colorHex: "#4F46E5" },
  { key: "presentation", label: "汇报", colorHex: "#0891B2" },
  { key: "target", label: "目标", colorHex: "#CA8A04" },
  { key: "languages", label: "语言", colorHex: "#7C2D12" },
  { key: "wallet", label: "财务", colorHex: "#15803D" },
  { key: "clipboard", label: "事务", colorHex: "#475569" },
  { key: "leaf", label: "散步", colorHex: "#65A30D" },
  { key: "shield", label: "维护", colorHex: "#0369A1" },
  { key: "design", label: "设计", colorHex: "#C026D3" },
];

export const DEFAULT_TASK_TYPE_COLOR = "#F47B20";

export function getTaskTypeColor(iconKey: string) {
  return TASK_ICON_CHOICES.find((choice) => choice.key === iconKey)?.colorHex ?? DEFAULT_TASK_TYPE_COLOR;
}
