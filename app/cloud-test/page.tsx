"use client";

import { useEffect, useState } from "react";
import { createClient } from "./supabase-client";

type CloudItem = {
  id: string;
  user_id: string;
  category: string;
  name: string;
  metadata: Record<string, unknown>;
  favorite: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TEST_NAME = "CLOUD TEST FORMATION";

export default function CloudTestPage() {
  const [items, setItems] = useState<CloudItem[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

async function getUserId(): Promise<string> {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("No authenticated user.");
  }

  return user.id;
}
  async function getUserId(): Promise<string> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(error.message);
    }

    if (!user) {
      throw new Error("No authenticated user.");
    }

    return user.id;
  }

  async function loadItems(): Promise<void> {
    setIsBusy(true);
    setMessage("");

    try {
      const supabase = createClient();
      const userId = await getUserId();

      const { data, error } = await supabase
        .from("call_sheet_items")
        .select(
          "id,user_id,category,name,metadata,favorite,sort_order,is_active,created_at,updated_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setItems((data ?? []) as CloudItem[]);
      setIsError(false);
      setMessage(`Loaded ${(data ?? []).length} cloud item(s).`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to load items.");
    } finally {
      setIsBusy(false);
    }
  }

  async function addTestFormation(): Promise<void> {
    setIsBusy(true);
    setMessage("");

    try {
      const supabase = createClient();
      const userId = await getUserId();

      const { error } = await supabase.from("call_sheet_items").insert({
        user_id: userId,
        category: "formation",
        name: TEST_NAME,
        metadata: {
          source: "cloud-test",
        },
        favorite: false,
        sort_order: 999,
        is_active: true,
      });

      if (error) {
        throw new Error(error.message);
      }

      setIsError(false);
      setMessage("Test formation added successfully.");
      await loadItems();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to add test item.");
      setIsBusy(false);
    }
  }

  async function deleteTestFormation(): Promise<void> {
    setIsBusy(true);
    setMessage("");

    try {
      const supabase = createClient();
      const userId = await getUserId();

      const { error } = await supabase
        .from("call_sheet_items")
        .delete()
        .eq("user_id", userId)
        .eq("category", "formation")
        .eq("name", TEST_NAME);

      if (error) {
        throw new Error(error.message);
      }

      setIsError(false);
      setMessage("Test formation deleted successfully.");
      await loadItems();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to delete test item.");
      setIsBusy(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Cloud Call Sheet Diagnostic</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Tests authenticated read, insert, and delete operations against Supabase.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={addTestFormation}
            disabled={isBusy}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            Add Test Formation
          </button>

          <button
            type="button"
            onClick={loadItems}
            disabled={isBusy}
            className="rounded-xl bg-zinc-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            Load Cloud Items
          </button>

          <button
            type="button"
            onClick={deleteTestFormation}
            disabled={isBusy}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-700 disabled:opacity-50"
          >
            Delete Test Formation
          </button>
        </div>

        {message ? (
          <div
            className={[
              "mb-6 rounded-xl border px-4 py-3 text-sm",
              isError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700",
            ].join(" ")}
          >
            {message}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 font-semibold">
            Cloud Items
          </div>

          {items.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              No cloud call-sheet items found.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {items.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.name}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                      {item.category}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-zinc-500">
                    ID: {item.id}
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    User: {item.user_id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <a
          href="/"
          className="mt-6 inline-block text-sm font-semibold text-blue-600 hover:underline"
        >
          Return to SCORE from FAR
        </a>
      </div>
    </main>
  );
}
