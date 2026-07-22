"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { authClient } from "@/lib/auth-client";

type FormStatus = "idle" | "loading" | "success";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("loading");

    const result = await authClient.signIn.email({
      callbackURL: "/dashboard",
      email,
      password,
      rememberMe: true,
    });

    if (result.error) {
      setError("The email or password is incorrect, or this account is not active.");
      setStatus("idle");
      return;
    }

    setStatus("success");
    router.replace("/dashboard");
    router.refresh();
  }

  const isSubmitting = status !== "idle";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--ink-slate)]" htmlFor="email">
          Work email
        </label>
        <Input
          autoComplete="email"
          disabled={isSubmitting}
          id="email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <label className="block text-sm font-medium text-[var(--ink-slate)]" htmlFor="password">
            Password
          </label>
          <button
            className="rounded-[4px] text-xs font-semibold text-[var(--primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            disabled={isSubmitting}
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <Input
          aria-describedby={error ? "login-error" : undefined}
          autoComplete="current-password"
          disabled={isSubmitting}
          id="password"
          minLength={12}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type={showPassword ? "text" : "password"}
          value={password}
        />
      </div>

      {error ? (
        <div
          className="border-l-4 border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm leading-5 text-[var(--ink-slate)]"
          id="login-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {status === "success" ? (
        <div
          className="border-l-4 border-[var(--success)] bg-[#e8f8f0] px-4 py-3 text-sm text-[var(--ink-slate)]"
          role="status"
        >
          Access granted. Opening your workspace…
        </div>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {status === "loading"
          ? "Verifying account…"
          : status === "success"
            ? "Access granted"
            : "Continue"}
      </Button>
    </form>
  );
}
