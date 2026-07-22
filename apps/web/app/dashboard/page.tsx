import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { OverviewDashboard } from "./overview-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
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

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const caller = appRouter.createCaller(await createTRPCContext({ headers: requestHeaders }));
  const today = todayInYangon();
  const dashboard = await caller.dashboard.today({ date: today });

  return <OverviewDashboard date={today} initialDashboard={dashboard} />;
}
