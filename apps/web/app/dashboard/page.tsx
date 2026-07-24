import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import {
  OverviewDashboard,
  type ProfitDateFilterValue,
  type ProfitDatePreset,
} from "./overview-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
};

type SearchParams = {
  date?: string | string[];
  profitFrom?: string | string[];
  profitRange?: string | string[];
  profitTo?: string | string[];
};

function todayInYangon() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Yangon",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isCalendarDate(candidate: string | undefined, maximumDate: string): candidate is string {
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate) || candidate > maximumDate) {
    return false;
  }
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate;
}

function selectedDate(value: string | string[] | undefined, today: string) {
  const candidate = scalar(value);
  return isCalendarDate(candidate, today) ? candidate : today;
}

function offsetCalendarDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isProfitDatePreset(value: string | undefined): value is ProfitDatePreset {
  return (
    value === "custom" ||
    value === "last-month" ||
    value === "this-month" ||
    value === "this-week" ||
    value === "today" ||
    value === "yesterday"
  );
}

function profitDateFilter(values: SearchParams, today: string): ProfitDateFilterValue {
  const requestedPreset = scalar(values.profitRange);
  const preset = isProfitDatePreset(requestedPreset) ? requestedPreset : "this-month";

  if (preset === "custom") {
    const fromDate = scalar(values.profitFrom);
    const toDate = scalar(values.profitTo);
    if (isCalendarDate(fromDate, today) && isCalendarDate(toDate, today) && fromDate <= toDate) {
      return { fromDate, preset, toDate };
    }
  }

  if (preset === "today") {
    return { fromDate: today, preset, toDate: today };
  }

  if (preset === "yesterday") {
    const yesterday = offsetCalendarDate(today, -1);
    return { fromDate: yesterday, preset, toDate: yesterday };
  }

  if (preset === "this-week") {
    const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    return {
      fromDate: offsetCalendarDate(today, -daysSinceMonday),
      preset,
      toDate: today,
    };
  }

  if (preset === "last-month") {
    const lastMonthEnd = offsetCalendarDate(`${today.slice(0, 7)}-01`, -1);
    return {
      fromDate: `${lastMonthEnd.slice(0, 7)}-01`,
      preset,
      toDate: lastMonthEnd,
    };
  }

  return {
    fromDate: `${today.slice(0, 7)}-01`,
    preset: "this-month",
    toDate: today,
  };
}

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const requestHeaders = await headers();
  const caller = appRouter.createCaller(await createTRPCContext({ headers: requestHeaders }));
  const today = todayInYangon();
  const values = await searchParams;
  const date = selectedDate(values.date, today);
  const profitFilter = profitDateFilter(values, today);
  const dashboard = await caller.dashboard.today({
    date,
    profitFromDate: profitFilter.fromDate,
    profitToDate: profitFilter.toDate,
  });

  return (
    <OverviewDashboard
      date={date}
      initialDashboard={dashboard}
      maximumDate={today}
      profitFilter={profitFilter}
    />
  );
}
