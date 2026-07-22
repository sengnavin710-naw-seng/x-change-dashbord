import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@repo/auth";

import { AdminShell } from "./admin-shell";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getSession(await headers());

  if (!session) {
    redirect("/login");
  }

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
