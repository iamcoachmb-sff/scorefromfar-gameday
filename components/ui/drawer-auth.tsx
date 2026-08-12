"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { saveCloudGameState } from "../data/game-state-repository";

const STORAGE_KEY = "mft-game-analytics-v6";
const TEST_DATASET_KEY = "mft-test-dataset-meta-v1";

export default function DrawerAuth() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthenticatedUser(): Promise<void> {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error) {
        console.error("Unable to load authenticated user", error);
        setEmail("");
      } else {
        setEmail(user?.email ?? "");
      }

      setIsLoading(false);
    }

    void loadAuthenticatedUser();

    return () => {
      isMounted = false;
    };
  }, []);

  async function flushCurrentGameToCloud(): Promise<void> {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as {
      plays?: unknown[];
      form?: Record<string, unknown>;
      undoHistory?: unknown[];
    };

    const testMetaRaw = window.localStorage.getItem(TEST_DATASET_KEY);
    const testDatasetMeta = testMetaRaw
      ? (JSON.parse(testMetaRaw) as Record<string, unknown>)
      : null;

    await saveCloudGameState({
      plays: Array.isArray(parsed.plays) ? parsed.plays : [],
      form:
        parsed.form && typeof parsed.form === "object"
          ? parsed.form
          : {},
      undoHistory: Array.isArray(parsed.undoHistory)
        ? parsed.undoHistory
        : [],
      testDatasetMeta,
    });
  }

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      // Critical game-day safeguard: persist the latest browser snapshot while
      // the Supabase session is still authenticated. This prevents sign-out
      // from invalidating the session before the final game save completes.
      await flushCurrentGameToCloud();

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new Error(error.message);
      }

      window.location.assign("/login");
    } catch (error) {
      console.error("Unable to safely sign out", error);
      window.alert(
        error instanceof Error
          ? `Unable to sign out safely: ${error.message}`
          : "Unable to sign out safely. Your game was not confirmed in the cloud."
      );
      setIsSigningOut(false);
    }
  }

  return (
    <div className="border-t border-zinc-200 pt-3">
      <div className="mb-3 rounded-xl bg-zinc-100 px-3 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Signed in as
        </div>

        <div className="mt-1 truncate text-sm font-semibold text-zinc-800">
          {isLoading ? "Loading..." : email || "No active user"}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={isLoading || isSigningOut || !email}
        className="flex h-10 w-full items-center justify-start rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true" className="mr-2">
          ↪
        </span>
        {isSigningOut ? "Saving & Signing Out..." : "Sign Out"}
      </button>
    </div>
  );
}
