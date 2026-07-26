"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { authClient } from "@/lib/auth-client";

import { useLanguage } from "../language-provider";

type FormStatus = "idle" | "loading" | "success";

export function LoginForm() {
  const router = useRouter();
  const { t } = useLanguage();
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
      setError(t("incorrectLogin"));
      setStatus("idle");
      return;
    }

    setStatus("success");
    router.replace("/dashboard");
    router.refresh();
  }

  const isSubmitting = status !== "idle";
  const feedbackId = error || status === "success" ? "login-feedback" : undefined;

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--ink-slate)]" htmlFor="email">
          {t("email")}
        </label>
        <Input
          autoComplete="email"
          disabled={isSubmitting}
          id="email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--ink-slate)]" htmlFor="password">
          {t("password")}
        </label>
        <div className="relative">
          <Input
            aria-describedby={feedbackId}
            autoComplete="current-password"
            className="pr-12"
            disabled={isSubmitting}
            id="password"
            minLength={12}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[4px] text-[var(--ink-muted)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => setShowPassword((visible) => !visible)}
            title={showPassword ? t("hidePassword") : t("showPassword")}
            type="button"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error ? (
          <p className="text-xs text-[var(--error)]" id="login-feedback" role="alert">
            {error}
          </p>
        ) : null}
        {status === "success" ? (
          <p className="text-xs text-[var(--success)]" id="login-feedback" role="status">
            {t("signedIn")}
          </p>
        ) : null}
      </div>

      <Button className="mt-2 w-full" disabled={isSubmitting} type="submit">
        {status === "loading" ? t("signingIn") : status === "success" ? t("signedIn") : t("signIn")}
      </Button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m3 3 18 18M10.6 6.2A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.7-.3 3.8-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
