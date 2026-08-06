"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function DrawerAuth() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

    loadAuthenticatedUser();

    return () => {
      isMounted = false;
    };
  }, []);

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

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="flex h-10 w-full items-center justify-start rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          <span aria-hidden="true" className="mr-2">
            ↪
          </span>
          Sign Out
        </button>
      </form>
    </div>
  );
}
