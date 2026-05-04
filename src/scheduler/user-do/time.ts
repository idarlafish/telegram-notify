import { PastDateError } from "../../lib/errors";

function parseHHMM(time: string): { h: number; m: number } {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`invalid time: ${time}`);
  }
  return { h, m };
}

function localParts(ms: number, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wkMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return {
    h: Number(get("hour")) % 24,
    m: Number(get("minute")),
    s: Number(get("second")),
    weekdayIdx: wkMap[get("weekday")] ?? 0,
  };
}

// Earliest UTC ms ≥ fromMs at which `time` falls on a day whose bit is set in
// `weekdays`, in `timezone`. Loops up to 7 days forward.
export function nextRecurring(
  time: string,
  timezone: string,
  weekdays: number,
  fromMs: number = Date.now(),
): number {
  const { h: targetH, m: targetM } = parseHHMM(time);
  const local = localParts(fromMs, timezone);

  let diffMin = (targetH - local.h) * 60 + (targetM - local.m);
  let dayOffset = 0;
  if (diffMin <= 0) {
    diffMin += 24 * 60;
    dayOffset = 1;
  }
  let candidate = fromMs + diffMin * 60_000 - local.s * 1000;
  let weekdayIdx = (local.weekdayIdx + dayOffset) % 7;

  for (let i = 0; i < 7; i++) {
    if ((weekdays & (1 << weekdayIdx)) !== 0) return candidate;
    candidate += 24 * 60 * 60_000;
    weekdayIdx = (weekdayIdx + 1) % 7;
  }
  throw new Error(`no day in mask ${weekdays}`);
}

// Returns the offset in ms between the given UTC instant and the local clock
// in `timezone` at that instant. (Local-as-UTC) - (true UTC) = offset.
function tzOffsetMs(at: number, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return localAsUtc - at;
}

// Single UTC ms for a one-time reminder. Throws if past.
export function oneTimeFireAt(
  date: string,
  time: string,
  timezone: string,
  nowMs: number = Date.now(),
): number {
  const { h, m } = parseHHMM(time);
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) throw new Error(`invalid date: ${date}`);
  const [, y, mo, d] = dateMatch;

  // Treat (date, h, m) as if it were UTC, then correct by the tz's offset.
  // Two-pass to absorb DST: the offset at the rough guess may differ from the
  // offset at the corrected moment if we cross a DST boundary.
  const localAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), h, m, 0);
  const offset1 = tzOffsetMs(localAsUtc, timezone);
  const offset2 = tzOffsetMs(localAsUtc - offset1, timezone);
  const result = localAsUtc - offset2;

  if (result <= nowMs) throw new PastDateError();
  return result;
}
