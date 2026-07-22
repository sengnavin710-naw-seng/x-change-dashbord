"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/button";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button className="w-full" disabled={isPending} onClick={signOut} size="sm" variant="outline">
      {isPending ? "ထွက်နေသည်… / Signing out…" : "ထွက်ရန် / Sign out"}
    </Button>
  );
}
