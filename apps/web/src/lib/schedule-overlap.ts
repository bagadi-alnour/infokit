export type WeeklyScheduleInterval = {
  weekday: number;
  startTime: string;
  endTime: string;
  endsNextDay?: boolean;
};

type MinuteInterval = {
  start: number;
  end: number;
};

const minutesPerDay = 24 * 60;
const minutesPerWeek = 7 * minutesPerDay;

function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function toMinuteIntervals(rule: WeeklyScheduleInterval): MinuteInterval[] {
  const dayStart = (rule.weekday - 1) * minutesPerDay;
  const start = dayStart + timeToMinutes(rule.startTime);
  const end =
    dayStart +
    timeToMinutes(rule.endTime) +
    (rule.endsNextDay ? minutesPerDay : 0);

  if (end <= minutesPerWeek) return [{ start, end }];

  return [
    { start, end: minutesPerWeek },
    { start: 0, end: end - minutesPerWeek },
  ];
}

/** Adjacent ranges are allowed; only ranges sharing actual minutes overlap. */
export function scheduleRulesOverlap(
  first: WeeklyScheduleInterval,
  second: WeeklyScheduleInterval,
): boolean {
  return toMinuteIntervals(first).some((firstInterval) =>
    toMinuteIntervals(second).some(
      (secondInterval) =>
        firstInterval.start < secondInterval.end &&
        secondInterval.start < firstInterval.end,
    ),
  );
}

export function hasScheduleRuleOverlap(
  candidate: WeeklyScheduleInterval,
  existingRules: readonly WeeklyScheduleInterval[],
): boolean {
  return existingRules.some((rule) => scheduleRulesOverlap(candidate, rule));
}
