import {
  Brain,
  BookOpenText,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  ClipboardList,
  Code2,
  Coffee,
  Dumbbell,
  Gamepad2,
  Headphones,
  HeartPulse,
  Home,
  Languages,
  Leaf,
  MessageCircleMore,
  MicVocal,
  MoonStar,
  NotebookPen,
  PenTool,
  Plane,
  Presentation,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  calendar: CalendarClock,
  code: Code2,
  work: BriefcaseBusiness,
  study: BookOpenText,
  meal: UtensilsCrossed,
  health: HeartPulse,
  fitness: Dumbbell,
  social: MessageCircleMore,
  travel: Plane,
  rest: MoonStar,
  coffee: Coffee,
  brain: Brain,
  home: Home,
  shopping: ShoppingCart,
  gamepad: Gamepad2,
  headphones: Headphones,
  camera: Camera,
  mic: MicVocal,
  notebook: NotebookPen,
  presentation: Presentation,
  target: Target,
  languages: Languages,
  wallet: Wallet,
  clipboard: ClipboardList,
  leaf: Leaf,
  shield: ShieldCheck,
  design: PenTool,
};

export function TaskIcon({
  iconKey,
  className,
}: {
  iconKey?: string;
  className?: string;
}) {
  const Icon = iconMap[iconKey ?? "sparkles"] ?? Sparkles;
  return <Icon className={className} strokeWidth={2.1} />;
}
