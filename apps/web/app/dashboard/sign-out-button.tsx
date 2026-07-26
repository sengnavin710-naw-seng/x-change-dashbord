"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/button";

import { authClient } from "@/lib/auth-client";

import { useLanguage } from "../language-provider";

export function SignOutButton() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      className="w-full rounded-none"
      disabled={isPending}
      onClick={signOut}
      size="sm"
      variant="outline"
    >
      {isPending ? t("signingOut") : t("signOut")}
    </Button>
  );
}
