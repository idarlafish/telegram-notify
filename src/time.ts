// Compute the next UTC ms timestamp at which `time` (HH:MM) occurs in `timezone`,
// strictly after `fromMs`. If today's local instance hasn't passed yet, returns
// today; otherwise tomorrow. DST shifts cause ±1h drift twice a year — acceptable
// for daily reminders; users can re-tune around the change.
export function computeNextFireAt(
  time: string,
  timezone: string,
  fromMs: number = Date.now(),
): number {
  const [hStr, mStr] = time.split(":");
  const targetH = Number(hStr);
  const targetM = Number(mStr);
  if (
    !Number.isInteger(targetH) ||
    !Number.isInteger(targetM) ||
    targetH < 0 ||
    targetH > 23 ||
    targetM < 0 ||
    targetM > 59
  ) {
    throw new Error(`invalid time: ${time}`);
  }

  // Get current local clock in the target tz.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(fromMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const localH = get("hour");
  const localM = get("minute");
  const localS = get("second");

  const localMinutesNow = localH * 60 + localM;
  const targetMinutes = targetH * 60 + targetM;
  let diffMinutes = targetMinutes - localMinutesNow;
  if (diffMinutes <= 0) diffMinutes += 24 * 60;

  // Subtract elapsed seconds within the current minute so we land on the exact
  // top of the target minute.
  return fromMs + diffMinutes * 60_000 - localS * 1000;
}
