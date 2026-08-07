"use client";

import { useEffect, useState } from "react";

type StorageItem = {
  key: string;
  rawLength: number;
  parsed: unknown;
  parseError: boolean;
};

function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `Array — ${value.length} item(s)`;
  }

  if (value && typeof value === "object") {
    return `Object — ${Object.keys(value as Record<string, unknown>).length} key(s)`;
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

export default function CallSheetMigrationDiagnosticPage() {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [message, setMessage] = useState("Scanning local browser storage...");

  useEffect(() => {
    const found: StorageItem[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key) continue;

      const raw = window.localStorage.getItem(key);

      if (raw === null) continue;

      try {
        found.push({
          key,
          rawLength: raw.length,
          parsed: JSON.parse(raw),
          parseError: false,
        });
      } catch {
        found.push({
          key,
          rawLength: raw.length,
          parsed: raw,
          parseError: true,
        });
      }
    }

    setItems(found);
    setMessage(
      found.length
        ? `Found ${found.length} localStorage record(s).`
        : "No localStorage records found on this device."
    );
  }, []);

  return (
    <main className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Call Sheet Migration Diagnostic
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Read-only inspection of the data currently stored in this browser.
            Nothing on this page uploads, changes, or deletes data.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
            No local browser data was found.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Storage Key
                    </div>

                    <div className="mt-1 break-all font-semibold text-zinc-900">
                      {item.key}
                    </div>
                  </div>

                  <div className="text-right text-xs text-zinc-500">
                    <div>{item.rawLength.toLocaleString()} characters</div>
                    <div>{summarizeValue(item.parsed)}</div>
                  </div>
                </div>

                {item.parseError ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This value is not JSON.
                  </div>
                ) : null}

                {item.parsed &&
                typeof item.parsed === "object" &&
                !Array.isArray(item.parsed) ? (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Top-Level Keys
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
  {Object.entries(
    item.parsed as Record<string, unknown>
  ).map(([key, value]) => {
    const isLibraries =
      key === "libraries" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value);

    if (isLibraries) {
      return (
        <div
          key={key}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 sm:col-span-2 lg:col-span-3"
        >
          <div className="font-semibold text-zinc-800">
            Libraries
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(
              value as Record<string, unknown>
            ).map(([libraryName, libraryValue]) => {
              const count = Array.isArray(libraryValue)
                ? libraryValue.length
                : libraryValue &&
                    typeof libraryValue === "object"
                  ? Object.keys(
                      libraryValue as Record<string, unknown>
                    ).length
                  : 0;

              return (
                <div
                  key={libraryName}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2"
                >
                  <span className="text-sm font-medium text-zinc-800">
                    {libraryName}
                  </span>

                  <span className="text-xs font-semibold text-zinc-500">
                    {count} item(s)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        key={key}
        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
      >
        <div className="font-medium text-zinc-800">
          {key}
        </div>

        <div className="mt-1 text-xs text-zinc-500">
          {summarizeValue(value)}
        </div>
      </div>
    );
  })}
</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

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
