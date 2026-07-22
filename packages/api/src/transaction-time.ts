export function dateInYangon(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Yangon",
    year: "numeric",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function effectiveTransactionAt(
  transactionDate: string,
  transactionAt: Date | null,
  createdAt: Date,
) {
  if (transactionAt) return transactionAt;

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Yangon",
  }).formatToParts(createdAt);
  const time = Object.fromEntries(timeParts.map((part) => [part.type, part.value]));
  const hour = time.hour === "24" ? "00" : time.hour;
  return new Date(`${transactionDate}T${hour}:${time.minute}:${time.second}+06:30`);
}
