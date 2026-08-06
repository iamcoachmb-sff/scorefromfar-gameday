"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearStatus(): void {
    setMessage("");
    setIsError(false);
  }

  function changeMode(nextMode: AuthMode): void {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    clearStatus();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    clearStatus();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setIsError(true);
      setMessage("Enter your email address.");
      return;
    }

    if (password.length < 6) {
      setIsError(true);
      setMessage("Password must contain at least 6 characters.");
      return;
    }

    if (mode === "sign-up" && password !== confirmPassword) {
      setIsError(true);
      setMessage("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          setIsError(true);
          setMessage(error.message);
          return;
        }

        window.location.href = "/";
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        setIsError(true);
        setMessage(error.message);
        return;
      }

      if (data.session) {
        window.location.href = "/";
        return;
      }

      setIsError(false);
      setMessage(
        "Account created. Check your email and confirm your account before signing in."
      );
    } catch (error) {
      console.error("Authentication error", error);
      setIsError(true);
      setMessage("Unable to complete the request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-8 text-zinc-900">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
            SCORE from FAR
          </div>

          <h1 className="mt-3 text-3xl font-bold text-zinc-900">
            {mode === "sign-in"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            {mode === "sign-in"
              ? "Sign in to access your call sheets and game data."
              : "Create an account to begin syncing across devices."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => changeMode("sign-in")}
            className={[
              "h-11 rounded-xl text-sm font-semibold transition",
              mode === "sign-in"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-zinc-500",
            ].join(" ")}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => changeMode("sign-up")}
            className={[
              "h-11 rounded-xl text-sm font-semibold transition",
              mode === "sign-up"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-zinc-500",
            ].join(" ")}
          >
            Create Account
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
              Email
            </span>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="coach@example.com"
              required
              className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
              Password
            </span>

            <input
              type="password"
              autoComplete={
                mode === "sign-in"
                  ? "current-password"
                  : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>

          {mode === "sign-up" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Confirm Password
              </span>

              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Re-enter your password"
                required
                minLength={6}
                className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </label>
          ) : null}

          {message ? (
            <div
              role="status"
              className={[
                "rounded-xl border px-3 py-3 text-sm",
                isError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700",
              ].join(" ")}
            >
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait..."
              : mode === "sign-in"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Continue to the current local app
          </a>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-5 text-center text-xs text-zinc-400">
          Authentication & Cloud Sync Preview
        </div>
      </div>
    </main>
  );
}
