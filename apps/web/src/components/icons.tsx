import {
  Activity,
  Archive,
  ArrowLeft,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  CalendarClock,
  CalendarDays,
  Download,
  FileClock,
  FileText,
  Globe2,
  GitBranch,
  House,
  Languages,
  Layers3,
  LayoutDashboard,
  MapPin,
  Phone,
  Plus,
  Settings2,
  Star,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/** One library-backed console icon vocabulary, always paired with text. */
const icons = {
  overview: LayoutDashboard,
  runbook: House,
  organization: Building2,
  place: MapPin,
  service: Layers3,
  catalogue: Boxes,
  settings: Settings2,
  plus: Plus,
  check: Check,
  chevronRight: ChevronRight,
  back: ArrowLeft,
  activity: Activity,
  archive: Archive,
  star: Star,
  clock: Clock3,
  alert: TriangleAlert,
  language: Languages,
  contact: Phone,
  calendar: CalendarDays,
  team: UsersRound,
  event: CalendarClock,
  article: FileText,
  download: Download,
  audit: FileClock,
  translation: Globe2,
  simulator: GitBranch,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Glyph = icons[name];
  return (
    <Glyph size={size} strokeWidth={1.8} aria-hidden className={className} />
  );
}
