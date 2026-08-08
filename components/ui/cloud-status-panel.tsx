"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadCloudLibraries,
  type CloudLibraries,
} from "../data/call-sheet-repository";

type CloudStatus =
  | "loading"
  | "connected"
  | "empty"
  | "error";

export default function CloudStatusPanel() {
  const [status, setStatus] = useState<CloudStatus>("loading");
  const [message, setMessage] = useState("Checking cloud connection...");
  const [libraries, setLibraries] = useState<CloudLibraries | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkCloud(): Promise<void> {
      try {
        const cloudLibraries = await loadCloudLibraries();

        if (!isMounted) return;

        setLibraries(cloudLibraries);

        const totalItems = Object.values(cloudLibraries).reduce(
          (sum, items) => sum + items.length,
          0
        );

        if (totalItems === 0) {
          setStatus("empty");
          setMessage("Cloud connected. No call-sheet items stored yet.");
          return;
        }

        setStatus("connected");
        setMessage(
          `Cloud connected. ${totalItems} call-sheet item(s) loaded.`
        );
      } catch (error) {
        if (!isMounted) return;

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to connect to cloud call-sheet storage."
        );
      }
    }

    checkCloud();

    return () => {
      isMounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    if (!libraries) {
      return [];
    }

    return [
      ["Formation", libraries.formation.length],
      ["Motion", libraries.motion.length],
      ["Protection", libraries.protection.length],
      ["Play", libraries.play.length],
      ["Run Concept", libraries.runConcept.length],
      ["Pass Concept", libraries.passConcept.length],
      ["Front", libraries.front.length],
      ["Blitz", libraries.blitz.length],
      ["Coverage", libraries.coverage.length],
    ] as const;
  }, [libraries]);

  const statusLabel =
    status === "loading"
      ? "Checking"
      : status === "connected"
        ? "Connected"
        : status === "empty"
          ? "Connected — Empty"
          : "Error";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            Cloud Status
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Supabase call-sheet connection and library counts.
          </p>
        </div>

        <div className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {statusLabel}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        {message}
      </div>

      {libraries ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(([label, count]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-3"
            >
              <span className="text-sm font-medium text-zinc-700">
                {label}
              </span>

              <span className="text-sm font-bold text-zinc-900">
                {count}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
