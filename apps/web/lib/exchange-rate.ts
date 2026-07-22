const YANGON_TIME_ZONE = "Asia/Yangon";

export function getYangonDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: YANGON_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour === "24" ? "00" : value.hour}:${value.minute}`,
  };
}

export function toYangonIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const parsed = new Date(`${date}T${time}:00+06:30`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function formatYangonDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: YANGON_TIME_ZONE,
  }).format(new Date(value));
}

export function formatRate(value: string) {
  return Number(value).toFixed(5);
}

export function formatInverseRate(value: string) {
  const rate = Number(value);
  return rate > 0
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(1 / rate)
    : "—";
}

export function formatWholePayout(value: string) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value));
}
