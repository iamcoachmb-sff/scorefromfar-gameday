"use client";

import React, { useEffect, useMemo, useState } from "react";

// =============================================================================
// 1. STORAGE KEYS AND APP CONSTANTS
// =============================================================================

const LOCAL_CALL_SHEET_KEY = "mft-local-call-sheet-v1";
const STORAGE_KEY = "mft-game-analytics-v6";
const TEST_DATASET_KEY = "mft-test-dataset-meta-v1";
const APP_VERSION = "0.9.9";

// =============================================================================
// 2. TYPES AND DATA MODELS
// Add or update shared TypeScript types in this section.
// =============================================================================

type HashOption = "" | "L" | "M" | "R";
type PlayType = "Run" | "Pass";
type ActiveScreen = "dashboard" | "manager" | "reports" | "developer";
const hashOptions: Exclude<HashOption, "">[] = ["L", "M", "R"];

const SYSTEM_RESULTS = [
  "Complete",
  "Incomplete",
  "Rush",
  "No Gain",
  "Rush TD",
  "Complete TD",
  "Interception",
  "Fumble",
  "Fumble Lost",
] as const;

type ActiveInput =   | "ballOn"   | "down"   | "distance"   | "quarter"   | "series"   | "sequence"   | "resultBallOn";

type LibraryKey =
  | "formation"
  | "motion"
  | "protection"
  | "play"
  | "runConcept"
  | "passConcept"
  | "front"
  | "blitz"
  | "coverage"

type Libraries = Record<LibraryKey, string[]>;

type PlayForm = {
  playNumber: number;
  quarter: number;
  series: number;
  sequence: number;
  down: number;
  distance: number;
  ballOn: number;
  hash: HashOption;
  playType: PlayType;
  formation: string;
  motion: string;
  protection: string;
  play: string;
  runConcept: string;
  passConcept: string;
  concept: string;
  front: string;
  blitz: string;
  coverage: string;
  result: string;
  yards: number;
  driveId: string;
  driveResult: string;
};

type DashboardSnapshot = {
  form: PlayForm;
  ballOnEntry: string;
  ballOnFreshEdit: boolean;
  resultBallOnEntry: string;
  resultBallOnFreshEdit: boolean;
};

type Play = PlayForm & {
  id: string;
  success: boolean;
};

type TopPlayRow = {
  play: string;
  dimension: string;
  attempts: number;
  success: number;
  yards: number;
  successRate: number;
};

type AnalyticsDimension =
  | "play"
  | "concept"
  | "formation"
  | "front"
  | "blitz"
  | "coverage"
  | "down"
  | "distance"
  | "fieldZone"
  | "hash"
  | "quarter";

type AnalyticsGroupRow = {
  values: Record<string, string>;
  attempts: number;
  success: number;
  explosives: number;
  yards: number;
  successRate: number;
  explosiveRate: number;
  averageYards: number;
};

type AggregateAnalyticsOptions = {
  playType?: PlayType;
  groupBy: AnalyticsDimension[];
  filter?: (play: Play) => boolean;
  limit?: number;
  sortBy?:
    | "successRate"
    | "explosiveRate"
    | "attempts"
    | "yards";
};


type EfficiencyRow = {
  down: number;
  bucket: string;
  front: string;
  blitz: string;
  coverage: string;
  runAttempts: number;
  runSuccess: number;
  passAttempts: number;
  passSuccess: number;
};

type SeriesRow = {
  series: number;
  plays: number;
  yards: number;
  success: number;
  successRate: number;
  latestResult: string;
};

// =============================================================================
// 3. DEFAULT DATA AND SEED VALUES
// Keep default libraries, default form values, and test seed data here.
// =============================================================================

const defaultLibraries: Libraries = {
  formation: [],
  motion: [],
  protection: [],
  play: [],
  runConcept: [],
  passConcept: [],
  front: [],
  blitz: [],
  coverage: [],
};

const defaultForm: PlayForm = {
  playNumber: 1065243,
  quarter: 1,
  series: 1,
  sequence: 1,
  down: 1,
  distance: 10,
  ballOn: 25,
  hash: "",
  playType: "Run",
  formation: "",
  motion: "",
  protection: "",
  play: "",
  runConcept: "",
  passConcept: "",
  concept: "",
  front: "",
  blitz: "",
  coverage: "",
  result: "",
  yards: 0,
  driveId: "drive-1",
  driveResult: "",
};

// =============================================================================
// 4. GENERAL UI AND FORMAT HELPERS
// These helpers format values or return reusable class names.
// =============================================================================

function panelClassName(extra = ""): string {
  return `rounded-2xl border border-zinc-300 bg-white shadow-sm ${extra}`.trim();
}

function buttonClassName(
  kind: "default" | "blue" | "green" | "danger" = "default",
  active = false,
  extra = ""
): string {
  const base =
    "inline-flex items-center justify-center rounded-2xl border font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const tone =
    kind === "blue"
      ? "border-blue-300 bg-blue-100 text-blue-700"
      : kind === "green"
        ? "border-green-300 bg-green-100 text-green-800"
        : kind === "danger"
          ? "border-red-300 bg-white text-red-600"
          : "border-zinc-300 bg-white text-zinc-700";
  const ring = active ? " ring-2 ring-blue-400" : "";
  return `${base} ${tone}${ring} ${extra}`.trim();
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function clampFieldPosition(value: number | string | undefined | null): number {
  return Math.max(1, Math.min(99, Number(value) || 1));
}

function formatBallOn(position: number | string | undefined | null): string {
  const pos = clampFieldPosition(position);
  if (pos === 50) return "50";
  if (pos < 50) return `-${pos}`;
  return `+${100 - pos}`;
}

function parseBallOn(displayValue: string): number {
  const raw = String(displayValue || "").trim();
  if (!raw) return 25;
  if (raw === "50") return 50;

  if (raw.startsWith("-")) {
    const amount = Math.max(1, Math.min(49, Number(raw.slice(1)) || 1));
    return clampFieldPosition(amount);
  }

  if (raw.startsWith("+")) {
    const amount = Math.max(1, Math.min(49, Number(raw.slice(1)) || 1));
    return clampFieldPosition(100 - amount);
  }

  const numeric = Math.max(1, Math.min(49, Number(raw) || 1));
  return clampFieldPosition(numeric);
}

// =============================================================================
// 5. FOOTBALL AND ANALYTICS HELPERS
// Put reusable football calculations here. These functions should not render UI.
// Future examples: isNegativePlay(), isPressure(), isTurnover().
// =============================================================================

function getFieldZone(
  position: number | string | undefined | null
): string {
  const pos = clampFieldPosition(position);

  if (pos >= 1 && pos <= 10) return "BACKED UP";
  if (pos >= 11 && pos <= 24) return "SAFE ZONE";
  if (pos >= 25 && pos <= 75) return "OPEN FIELD";
  if (pos >= 76 && pos <= 89) return "RED ZONE";
  return "GOAL LINE";
}

function getDistanceBucket(distance: number | string | undefined | null): string {
  const d = Number(distance || 0);
  if (d <= 3) return "Short (1-3)";
  if (d <= 6) return "Medium (4-6)";
  return "Long (7+)";
}

type SeriesStartType =
  | "POSSESSION_START"
  | "FIRST_DOWN"
  | "PENALTY"
  | "TURNOVER"
  | "MANUAL";

function getHudlDdcat(
  down: number | string | undefined | null,
  distance: number | string | undefined | null,
  sequence: number | string | undefined | null,
  seriesStartType?: SeriesStartType | null
): string {
  const d = Number(down || 0);
  const dist = Math.max(0, Number(distance || 0));
  const seq = Number(sequence || 0);

  if (d === 1) {
    if (seriesStartType === "POSSESSION_START") {
      return "P & 10";
    }

    if (seriesStartType === "FIRST_DOWN") {
      return "1 DN";
    }

    if (
      seriesStartType === "PENALTY" ||
      seriesStartType === "MANUAL"
    ) {
      return dist <= 10 ? "Normal" : "Off Schedule";
    }

    // Temporary fallback until seriesStartType is added to every play.
    if (dist === 10 && seq === 1) {
      return "P & 10";
    }

    if (dist === 10) {
      return "1 DN";
    }

    return dist <= 10 ? "Normal" : "Off Schedule";
  }

  if (d === 2) {
    return dist <= 6 ? "Normal" : "Off Schedule";
  }

  const bucket = dist <= 3 ? "SH" : dist <= 6 ? "M" : "L";

  if (d === 3) return `3rd ${bucket}`;
  if (d === 4) return `4th ${bucket}`;

  return "Normal";
}

function getSuccess(
  play: Pick<PlayForm, "down" | "distance" | "yards">
): boolean {
  const down = Number(play.down || 0);
  const distance = Math.max(1, Number(play.distance || 0));
  const yards = Number(play.yards || 0);

  if (down === 1) {
    return yards >= Math.ceil(distance * 0.4);
  }

  if (down === 2) {
    return yards >= Math.ceil(distance * 0.5);
  }

  if (down === 3 || down === 4) {
    return yards >= distance;
  }

  return false;
}

/**
 * Returns true when a play meets the current explosive-play standard.
 * - Run: 10+ yards
 * - Pass: 15+ yards
 * - Any rushing or completed passing touchdown
 */
function isExplosive(
  play: Pick<PlayForm, "playType" | "yards" | "result">
): boolean {
  const yards = Number(play.yards || 0);
  const result = String(play.result || "").trim().toLowerCase();

  const isTouchdown =
    result === "rush td" ||
    result === "complete td" ||
    result === "touchdown" ||
    result === "complete, td";

  if (isTouchdown) return true;
  if (play.playType === "Run") return yards >= 10;
  if (play.playType === "Pass") return yards >= 15;

  return false;
}

function getAnalyticsDimensionValue(
  play: Play,
  dimension: AnalyticsDimension
): string {
  switch (dimension) {
    case "play":
      return String(play.play || "—");

    case "concept":
      return String(
        play.concept ||
          play.runConcept ||
          play.passConcept ||
          "—"
      );

    case "formation":
      return String(play.formation || "—");

    case "front":
      return String(play.front || "—");

    case "blitz":
      return String(play.blitz?.trim() || "No Blitz");

    case "coverage":
      return String(play.coverage || "—");

    case "down":
      return String(play.down || "—");

    case "distance":
      return getDistanceBucket(play.distance);

    case "fieldZone":
      return getFieldZone(play.ballOn);

    case "hash":
      return String(play.hash || "—");

    case "quarter":
      return `Q${Number(play.quarter || 1)}`;

    default:
      return "—";
  }
}

function aggregateAnalytics(
  plays: Play[],
  options: AggregateAnalyticsOptions
): AnalyticsGroupRow[] {
  const {
    playType,
    groupBy,
    filter,
    limit,
    sortBy = "successRate",
  } = options;

  const grouped = new Map<
    string,
    {
      values: Record<string, string>;
      attempts: number;
      success: number;
      explosives: number;
      yards: number;
    }
  >();

  plays
    .filter((play) => {
      if (playType && play.playType !== playType) {
        return false;
      }

      if (filter && !filter(play)) {
        return false;
      }

      return true;
    })
    .forEach((play) => {
      const values = groupBy.reduce<Record<string, string>>(
        (result, dimension) => {
          result[dimension] = getAnalyticsDimensionValue(
            play,
            dimension
          );

          return result;
        },
        {}
      );

      const key = groupBy
        .map((dimension) => values[dimension])
        .join("|");

      const current = grouped.get(key) || {
        values,
        attempts: 0,
        success: 0,
        explosives: 0,
        yards: 0,
      };

      current.attempts += 1;
      current.success += play.success ? 1 : 0;
      current.explosives += isExplosive(play) ? 1 : 0;
      current.yards += Number(play.yards || 0);

      grouped.set(key, current);
    });

  const rows = Array.from(grouped.values()).map(
    (item): AnalyticsGroupRow => ({
      values: item.values,
      attempts: item.attempts,
      success: item.success,
      explosives: item.explosives,
      yards: item.yards,
      successRate:
        item.attempts > 0
          ? (item.success / item.attempts) * 100
          : 0,
      explosiveRate:
        item.attempts > 0
          ? (item.explosives / item.attempts) * 100
          : 0,
      averageYards:
        item.attempts > 0
          ? item.yards / item.attempts
          : 0,
    })
  );

  rows.sort((a, b) => {
    const primaryDifference =
      sortBy === "explosiveRate"
        ? b.explosiveRate - a.explosiveRate
        : sortBy === "attempts"
          ? b.attempts - a.attempts
          : sortBy === "yards"
            ? b.yards - a.yards
            : b.successRate - a.successRate;

    return (
      primaryDifference ||
      b.attempts - a.attempts ||
      b.yards - a.yards ||
      groupBy
        .map((dimension) => a.values[dimension])
        .join("|")
        .localeCompare(
          groupBy
            .map((dimension) => b.values[dimension])
            .join("|")
        )
    );
  });

  return typeof limit === "number"
    ? rows.slice(0, limit)
    : rows;
}



function getNextDownDistance(
  play: Pick<PlayForm, "down" | "distance" | "yards">,
  nextBallOn: number
): { down: number; distance: number } {
  const yardsToGoal = Math.max(1, 100 - nextBallOn);
  const gainedFirstDown = Number(play.yards || 0) >= Number(play.distance || 0);

  if (gainedFirstDown || Number(play.down || 0) >= 4) {
    return {
      down: 1,
      distance: Math.min(10, yardsToGoal),
    };
  }

  return {
    down: Math.min(Number(play.down || 1) + 1, 4),
    distance: Math.min(
      Math.max(Number(play.distance || 10) - Number(play.yards || 0), 1),
      yardsToGoal
    ),
  };
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function exportFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);

  requestAnimationFrame(() => {
    anchor.click();
    setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  });
}

function normalizeLibraries(libraries?: Partial<Libraries> | null): Libraries {
  const keys = [
  "formation",
  "motion",
  "protection",
  "play",
  "runConcept",
  "passConcept",
  "front",
  "blitz",
  "coverage",
] as LibraryKey[];

  const next = {} as Libraries;

  keys.forEach((key) => {
    const values = Array.isArray(libraries?.[key]) ? libraries?.[key] ?? [] : [];
    next[key] = Array.from(
      new Set(values.map((v) => String(v || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  });

  return next;
}

const TOP_REPORT_MIN_ATTEMPTS = 5;
const SITUATIONAL_TREND_MINIMUM = 8;
const SITUATIONAL_STRONG_SAMPLE_MINIMUM = 10;

function getWeightedPerformanceScore(row: AnalyticsGroupRow): number {
  const normalizedAverageGain = Math.min(Math.max(row.averageYards, 0) / 15, 1) * 100;

  return (
    row.successRate * 0.6 +
    row.explosiveRate * 0.25 +
    normalizedAverageGain * 0.15
  );
}

function rankQualifiedAnalyticsRows(
  rows: AnalyticsGroupRow[],
  limit: number
): AnalyticsGroupRow[] {
  return rows
    .filter((row) => row.attempts >= TOP_REPORT_MIN_ATTEMPTS)
    .sort((a, b) => {
      return (
        getWeightedPerformanceScore(b) - getWeightedPerformanceScore(a) ||
        b.attempts - a.attempts ||
        b.successRate - a.successRate ||
        b.explosiveRate - a.explosiveRate ||
        b.averageYards - a.averageYards
      );
    })
    .slice(0, limit);
}

function getSituationalSampleLabel(opportunities: number): string {
  if (opportunities >= SITUATIONAL_STRONG_SAMPLE_MINIMUM) {
    return "Strong game sample";
  }

  if (opportunities >= SITUATIONAL_TREND_MINIMUM) {
    return "Emerging game trend";
  }

  if (opportunities >= 5) {
    return "Limited sample";
  }

  return "Very limited sample";
}

function aggregateTopPlays(
  plays: Play[],
  type: PlayType,
  dimension: Extract<
    AnalyticsDimension,
    "front" | "blitz" | "coverage"
  >
): TopPlayRow[] {
  return rankQualifiedAnalyticsRows(
    aggregateAnalytics(plays, {
      playType: type,
      groupBy: ["play", dimension],
    }),
    3
  ).map((row) => ({
    play: row.values.play,
    dimension: row.values[dimension],
    attempts: row.attempts,
    success: row.success,
    yards: row.yards,
    successRate: row.successRate,
  }));
}

function aggregateTopPassConceptsByFormation(plays: Play[]): TopPlayRow[] {
  return rankQualifiedAnalyticsRows(
    aggregateAnalytics(plays, {
      playType: "Pass",
      groupBy: ["concept", "formation"],
    }),
    3
  ).map((row) => ({
    play: row.values.concept,
    dimension: row.values.formation,
    attempts: row.attempts,
    success: row.success,
    yards: row.yards,
    successRate: row.successRate,
  }));
}

function seedPlay(overrides: Partial<Play>): Play {
  const base: Omit<Play, "success"> = {
    id: makeId(),
    playNumber: 1065243,
    quarter: 1,
    series: 1,
    sequence: 1,
    down: 1,
    distance: 10,
    ballOn: 25,
    hash: "L",
    playType: "Run",
    formation: "DBL",
    motion: "NONE",
    protection: "50",
    play: "16",
    runConcept: "HOUSTON",
    passConcept: "",
    concept: "HOUSTON",
    front: "4D Over",
    blitz: "",
    coverage: "3",
    result: "Rush",
    yards: 5,
    driveId: "drive-1",
    driveResult: "",
  };

  const play = { ...base, ...overrides };
  return { ...play, success: getSuccess(play) };
}

const seedPlays: Play[] = [
  seedPlay({ yards: 6, play: "16", runConcept: "HOUSTON", concept: "HOUSTON" }),
  seedPlay({
    down: 2,
    distance: 4,
    ballOn: 31,
    hash: "M",
    playType: "Pass",
    play: "17",
    passConcept: "SEATTLE",
    concept: "SEATTLE",
    runConcept: "",
    result: "Complete",
    yards: 5,
    sequence: 2,
    front: "Odd",
  }),
  seedPlay({
    down: 1,
    distance: 10,
    ballOn: 36,
    hash: "R",
    playType: "Run",
    play: "10 CAB",
    runConcept: "ORLANDO",
    concept: "ORLANDO",
    yards: 2,
    sequence: 3,
    blitz: "PLUG",
    coverage: "4",
  }),
  seedPlay({
    down: 3,
    distance: 8,
    ballOn: 38,
    hash: "L",
    playType: "Pass",
    play: "11 CAB",
    passConcept: "HOUSTON",
    concept: "HOUSTON",
    runConcept: "",
    result: "Complete",
    yards: 9,
    sequence: 4,
    blitz: "6",
    coverage: "2",
    front: "Bear",
  }),
];

// =============================================================================
// 6. REUSABLE REACT UI COMPONENTS
// Add small reusable visual components here.
// =============================================================================

function KeyButton({
  children,
  className = "",
  active = false,
  kind = "default",
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  kind?: "default" | "blue" | "green" | "danger";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName(kind, active, className)}
    >
      {children}
    </button>
  );
}

function StatBox({
  label,
  value,
  blue = false,
  active = false,
}: {
  label: string;
  value: React.ReactNode;
  blue?: boolean;
  active?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-200">{label}</div>
      <div
        className={[
          "flex h-[52px] items-center justify-center rounded-xl border text-3xl font-bold shadow-inner",
          blue ? "border-blue-400 bg-blue-600 text-white" : "border-zinc-300 bg-white text-zinc-700",
          active ? "ring-2 ring-yellow-400" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-2 text-center shadow-inner">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-300">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function BottomNav({
  onGoDashboard,
  onGoManager,
  onGoReports,
}: {
  onGoDashboard: () => void;
  onGoManager: () => void;
  onGoReports: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-sm text-blue-600">
      <button type="button" className="font-medium hover:underline" onClick={onGoDashboard}>
        Main Dashboard
      </button>
      <button type="button" className="font-medium hover:underline" onClick={onGoManager}>
        Call Sheet Manager
      </button>
      <button type="button" className="font-medium hover:underline" onClick={onGoReports}>
        Reports
      </button>
    </div>
  );
}

function PlaylistColumn({
  label,
  items,
  selectedValue,
  onSelect,
}: {
  label: string;
  items: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className={panelClassName()}>
      <div className="border-b border-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="h-[240px] overflow-y-auto px-2 py-1.5">
        <div className="space-y-1">
          {items.length ? (
            items.map((item) => {
              const active = selectedValue === item;
              return (
                <button
                  key={`${label}-${item}`}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={[
                    "flex w-full items-start justify-start rounded-md px-2 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-50",
                    active ? "bg-blue-50 text-blue-700" : "",
                  ].join(" ")}
                >
                  {item}
                </button>
              );
            })
          ) : (
            <div className="px-2 py-1 text-sm text-zinc-400">No items</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpreadsheetColumn({
  label,
  items,
  draft,
  onDraftChange,
  onSave,
  onDelete,
}: {
  label: string;
  items: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onDelete: (value: string) => void;
}) {
  return (
    <div className={panelClassName()}>
      <div className="p-3">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={`One ${label.toLowerCase()} value per line`}
          className="mb-2 h-24 w-full resize-none rounded-lg border border-zinc-300 bg-white p-2 text-sm outline-none"
        />
        <button
          type="button"
          className={buttonClassName("blue", false, "mb-2 h-10 w-full")}
          onClick={onSave}
        >
          Save {label}
        </button>
        <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
          {items.length ? (
            items.map((item) => (
              <div
                key={`${label}-${item}`}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1"
              >
                <div className="min-w-0 flex-1 truncate text-sm text-zinc-700">{item}</div>
                <button
                  type="button"
                  className={buttonClassName("default", false, "h-8 px-2 text-xs")}
                  onClick={() => onDelete(item)}
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-400">
              No values
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 7. MAIN DASHBOARD SCREEN
// Game entry state, dashboard calculations, and game-day UI live here.
// =============================================================================

function MainDashboard({
  libraries,
  onOpenReports,
  onOpenManager,
  onPrintReports,
  onOpenDeveloper,
}: {
  libraries: Libraries;
  onOpenReports: () => void;
  onOpenManager: () => void;
  onPrintReports: () => void;
  onOpenDeveloper: () => void;
}) {
  const [plays, setPlays] = useState<Play[]>([]);
  const [form, setForm] = useState<PlayForm>(defaultForm);
  const [activeInput, setActiveInput] =   useState<ActiveInput>("resultBallOn");
  const [distanceFreshEdit, setDistanceFreshEdit] = useState(true);
  const [ballOnEntry, setBallOnEntry] = useState<string>(formatBallOn(defaultForm.ballOn));
  const [ballOnFreshEdit, setBallOnFreshEdit] = useState<boolean>(false);
  const [undoHistory, setUndoHistory] = useState<DashboardSnapshot[]>([]);
  const [resultBallOnEntry, setResultBallOnEntry] = useState<string>(
    formatBallOn(defaultForm.ballOn)
  );
  const [resultBallOnFreshEdit, setResultBallOnFreshEdit] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
  plays?: Play[];
  form?: Partial<PlayForm>;
  undoHistory?: DashboardSnapshot[];
};

if (Array.isArray(parsed.plays)) setPlays(parsed.plays);
if (Array.isArray(parsed.undoHistory)) setUndoHistory(parsed.undoHistory);

if (parsed.form) {
          const nextForm: PlayForm = {
            ...defaultForm,
            ...parsed.form,
            ballOn: clampFieldPosition(parsed.form.ballOn ?? defaultForm.ballOn),
          };
          setForm(nextForm);
          setBallOnEntry(formatBallOn(nextForm.ballOn));
          setResultBallOnEntry(formatBallOn(nextForm.ballOn));
        }
      }
    } catch (error) {
      console.error("Unable to load saved state", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
  if (!hydrated) return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ plays, form, undoHistory })
  );
}, [plays, form, undoHistory, hydrated]);

  useEffect(() => {
    const formatted = formatBallOn(form.ballOn);
    setBallOnEntry(formatted);
    setResultBallOnEntry(formatted);
    setResultBallOnFreshEdit(true);
  }, [form.ballOn]);

  const summary = useMemo(() => {
    const runCount = plays.filter((p) => p.playType === "Run").length;
    const passCount = plays.filter((p) => p.playType === "Pass").length;
    const matchingConcept = plays.filter((p) => p.concept === form.concept && form.concept);
    const conceptSuccess = matchingConcept.filter((p) => p.success).length;
    const blitzCount = plays.filter((p) => Boolean(p.blitz?.trim())).length;

    // Explosive-play dashboard KPIs
    const explosivePlays = plays.filter(isExplosive);
    const runExplosives = explosivePlays.filter((p) => p.playType === "Run").length;
    const passExplosives = explosivePlays.filter((p) => p.playType === "Pass").length;
    const explosiveRate = plays.length
      ? (explosivePlays.length / plays.length) * 100
      : 0;

    return {
      run: runCount,
      pass: passCount,
      efficiencyLabel: `${form.concept || "—"} ${formatPct(
        (conceptSuccess / (matchingConcept.length || 1)) * 100
      )}`,
      blitzLabel: formatPct((blitzCount / (plays.length || 1)) * 100),
      fieldPositionLabel: getFieldZone(form.ballOn),
      explosivePlays: explosivePlays.length,
      explosiveRateLabel: formatPct(explosiveRate),
      runExplosives,
      passExplosives,
    };
  }, [plays, form.concept, form.ballOn]);

  const selectedPlayText = useMemo(() => {
    const parts = [
      form.formation,
      form.motion && form.motion !== "NONE" ? form.motion : "",
      form.protection,
      form.play,
    ].filter(Boolean);
    return parts.length ? parts.join(" | ") : "";
  }, [form.formation, form.motion, form.protection, form.play]);

  const goStatus = useMemo(() => {
    if (!form.hash) {
      return {
        ready: false,
        message: "SELECT HASH",
        missing: "hash",
      } as const;
    }

    if (!form.runConcept && !form.passConcept) {
      return {
        ready: false,
        message: "SELECT CONCEPT",
        missing: "concept",
      } as const;
    }

    if (!form.result) {
      return {
        ready: false,
        message: "SELECT RESULT",
        missing: "result",
      } as const;
    }

    if (!Number.isFinite(form.down)) {
      return {
        ready: false,
        message: "CHECK DOWN",
        missing: "down",
      } as const;
    }

    if (!Number.isFinite(form.distance)) {
      return {
        ready: false,
        message: "CHECK DISTANCE",
        missing: "distance",
      } as const;
    }

    if (!Number.isFinite(form.ballOn)) {
      return {
        ready: false,
        message: "CHECK BALL ON",
        missing: "ballOn",
      } as const;
    }

    return {
      ready: true,
      message: "GO",
      missing: "",
    } as const;
  }, [
    form.hash,
    form.runConcept,
    form.passConcept,
    form.result,
    form.down,
    form.distance,
    form.ballOn,
  ]);

  function updateField<K extends keyof PlayForm>(name: K, value: PlayForm[K]): void {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function applyPlaylistSelection(type: LibraryKey, value: string): void {
  setForm((prev) => {
    if (type === "runConcept") {
      const isDeselecting = prev.runConcept === value;
      return {
        ...prev,
        runConcept: isDeselecting ? "" : value,
        passConcept: "",
        playType: "Run",
        concept: isDeselecting ? "" : value,
      };
    }

    if (type === "passConcept") {
      const isDeselecting = prev.passConcept === value;
      return {
        ...prev,
        passConcept: isDeselecting ? "" : value,
        runConcept: "",
        playType: "Pass",
        concept: isDeselecting ? "" : value,
      };
    }

    if (type === "formation") {
      return { ...prev, formation: prev.formation === value ? "" : value };
    }

    if (type === "motion") {
      return { ...prev, motion: prev.motion === value ? "" : value };
    }

    if (type === "protection") {
      return { ...prev, protection: prev.protection === value ? "" : value };
    }

    if (type === "play") {
      return { ...prev, play: prev.play === value ? "" : value };
    }

    if (type === "front") {
      return { ...prev, front: prev.front === value ? "" : value };
    }

    if (type === "blitz") {
      return { ...prev, blitz: prev.blitz === value ? "" : value };
    }

    if (type === "coverage") {
      return { ...prev, coverage: prev.coverage === value ? "" : value };
    }

    return prev;
  });
}

   function appendSignedFieldDigit(
  currentEntry: string,
  freshEdit: boolean,
  digit: string
): string {
  const raw = currentEntry.trim();

  let sign: "+" | "-";
  if (raw.startsWith("+")) {
    sign = "+";
  } else {
    sign = "-";
  }

  const existingDigits = raw === "50" ? "" : raw.replace(/^[+-]/, "");
  const nextDigits = freshEdit
    ? digit
    : `${existingDigits}${digit}`.replace(/\D/g, "").slice(0, 2);

  const numericValue = Number(nextDigits || 0);

  if (numericValue >= 50) return "50";

  const clamped = Math.max(1, Math.min(49, numericValue || 25));
  return `${sign}${clamped}`;
}

  function appendDigit(digit: string): void {
  if (activeInput === "ballOn") {
    const nextEntry = appendSignedFieldDigit(ballOnEntry, ballOnFreshEdit, digit);

    setBallOnEntry(nextEntry);
    setForm((prev) => ({
      ...prev,
      ballOn: parseBallOn(nextEntry),
    }));
    setBallOnFreshEdit(false);
    return;
  }

  if (activeInput === "resultBallOn") {
    const nextEntry = appendSignedFieldDigit(
      resultBallOnEntry,
      resultBallOnFreshEdit,
      digit
    );

    setResultBallOnEntry(nextEntry);
    setResultBallOnFreshEdit(false);
    return;
  }
    
if (activeInput === "down") {
  const nextDown = Number(digit);

  if (nextDown < 1 || nextDown > 4) {
    return;
  }

  setForm((prev) => ({
    ...prev,
    down: nextDown,
  }));

  return;
}

if (activeInput === "distance") {
  setForm((prev) => {
    const currentDistance = String(prev.distance ?? "");

    const nextValue = distanceFreshEdit
      ? digit
      : `${currentDistance}${digit}`;

    const nextDistance = Number(nextValue.slice(0, 2));

    if (!Number.isFinite(nextDistance)) {
      return prev;
    }

    return {
      ...prev,
      distance: nextDistance,
    };
  });

  setDistanceFreshEdit(false);
  return;
}

setForm((prev) => {
  const current = String(prev[activeInput] ?? "");
  const normalized = current === "0" ? "" : current;
  const nextNum = Number(`${normalized}${digit}`);

  if (Number.isNaN(nextNum)) {
    return prev;
  }

  return {
    ...prev,
    [activeInput]: nextNum,
  };
});
}
  
  function applySign(sign: "+" | "-"): void {
  if (activeInput === "ballOn") {
    const raw = ballOnEntry.trim();
    const currentDigits = raw === "50" ? "50" : raw.replace(/^[+-]/, "") || "25";
    const numericValue = Number(currentDigits || 25);
    const nextEntry =
      numericValue >= 50
        ? "50"
        : `${sign}${Math.max(1, Math.min(49, numericValue || 25))}`;

    setBallOnEntry(nextEntry);
    setForm((prev) => ({ ...prev, ballOn: parseBallOn(nextEntry) }));
    setBallOnFreshEdit(false);
    return;
  }

  if (activeInput === "resultBallOn") {
    const raw = resultBallOnEntry.trim();
    const currentDigits = raw === "50" ? "50" : raw.replace(/^[+-]/, "") || "25";
    const numericValue = Number(currentDigits || 25);
    const nextEntry =
      numericValue >= 50
        ? "50"
        : `${sign}${Math.max(1, Math.min(49, numericValue || 25))}`;

    setResultBallOnEntry(nextEntry);
    setResultBallOnFreshEdit(false);
    return;
  }

  setForm((prev) => {
    const value = Math.abs(Number(prev[activeInput] || 0));
    return { ...prev, [activeInput]: sign === "+" ? value : -value };
  });
}

  function clearResultBallOn(): void {
    const formatted = formatBallOn(form.ballOn);
    setResultBallOnEntry(formatted);
    setResultBallOnFreshEdit(true);
  }

  function isTouchdownResult(result: string): boolean {
    const normalized = String(result || "").trim().toLowerCase();
    return (
      normalized === "touchdown" ||
      normalized === "rush td" ||
      normalized === "complete td" ||
      normalized === "complete, td"
    );
  }

  function normalizePlay(data: PlayForm & { id: string }): Play {
    const play: Play = {
      ...data,
      ballOn: clampFieldPosition(data.ballOn || 25),
      success: false,
    };

    if (isTouchdownResult(play.result)) {
      play.yards = Math.max(0, 100 - Number(play.ballOn || 25));
    }

    play.success = getSuccess(play);
    return play;
  }

  function commitPlay(): void {
  const parsedResultBallOn = parseBallOn(resultBallOnEntry);

  if (
    !form.hash ||
    !form.result ||
    (!form.runConcept && !form.passConcept) ||
    !Number.isFinite(form.down) ||
    !Number.isFinite(form.distance) ||
    !Number.isFinite(form.ballOn) ||
    !Number.isFinite(parsedResultBallOn)
  ) {
    return;
  }

  const normalizedResult = String(form.result || "").trim().toLowerCase();
  const isTouchdown = isTouchdownResult(form.result);
  const isTurnover =
    normalizedResult === "interception" ||
    normalizedResult === "fumble lost" ||
    normalizedResult === "lost" ||
    normalizedResult === "turnover";

  const calculatedYards = isTouchdown
    ? Math.max(0, 100 - Number(form.ballOn || 25))
    : parsedResultBallOn - Number(form.ballOn || 25);

  const play = normalizePlay({
    ...form,
    id: makeId(),
    yards: calculatedYards,
  });

  const nextBallOn =
    isTouchdown || isTurnover ? 25 : clampFieldPosition(parsedResultBallOn);

  const nextSeriesState =
    isTouchdown || isTurnover
      ? { down: 1, distance: 10, series: Number(form.series || 1) + 1, sequence: 1 }
      : {
          ...getNextDownDistance(play, nextBallOn),
          series: Number(form.series || 1),
          sequence: Number(form.sequence || 0) + 1,
        };

  const snapshot: DashboardSnapshot = {
    form: { ...form },
    ballOnEntry,
    ballOnFreshEdit,
    resultBallOnEntry,
    resultBallOnFreshEdit,
  };

  setUndoHistory((prev) => [...prev, snapshot]);
  setPlays((prev) => [...prev, play]);

  setForm((prev) => ({
    ...prev,
    playNumber: Number(prev.playNumber || defaultForm.playNumber) + 1,
    quarter: prev.quarter,
    series: nextSeriesState.series,
    sequence: nextSeriesState.sequence,
    down: nextSeriesState.down,
    distance: nextSeriesState.distance,
    ballOn: nextBallOn,
    hash: "",
    yards: 0,
    formation: "",
    motion: "",
    protection: "",
    play: "",
    runConcept: "",
    passConcept: "",
    concept: "",
    front: "",
    blitz: "",
    coverage: "",
    result: "",
  }));

  setBallOnEntry(formatBallOn(nextBallOn));
  setBallOnFreshEdit(false);
  setResultBallOnEntry(formatBallOn(nextBallOn));
  setResultBallOnFreshEdit(true);
  setActiveInput("resultBallOn");  
}

  function undoLastPlay(): void {
  if (!undoHistory.length) return;

  const previousSnapshot = undoHistory[undoHistory.length - 1];

  setPlays((prev) => prev.slice(0, -1));
  setUndoHistory((prev) => prev.slice(0, -1));
  setForm(previousSnapshot.form);
  setBallOnEntry(previousSnapshot.ballOnEntry);
  setBallOnFreshEdit(previousSnapshot.ballOnFreshEdit);
  setResultBallOnEntry(previousSnapshot.resultBallOnEntry);
  setResultBallOnFreshEdit(previousSnapshot.resultBallOnFreshEdit);
}

  function startNewGame(): void {
    setPlays([]);
    setUndoHistory([]);
    setForm(defaultForm);
    setBallOnEntry(formatBallOn(defaultForm.ballOn));
    setBallOnFreshEdit(false);
    setResultBallOnEntry(formatBallOn(defaultForm.ballOn));
    setResultBallOnFreshEdit(true);
    setActiveInput("resultBallOn");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function handleNewGame(): void {
    if (confirmNewGame) {
      startNewGame();
      setConfirmNewGame(false);
      return;
    }
    setConfirmNewGame(true);
  }

  function exportHudlCsv(): void {
    const headers = [
      "PLAY #",
      "ODK",
      "DDCAT",
      "FLD ZONE",
      "DN",
      "DIST",
      "YARD LN",
      "HASH",
      "OFF FORM",
      "MOTION",
      "OFF PLAY",
      "PLAY TYPE",
      "RESULT",
      "GN/LS",
      "EFF",
      "DEF FRONT",
      "BLITZ",
      "COVERAGE",
      "QTR",
      "SERIES",
      "OPP TEAM",
    ];

    const rows = plays.map((play, index) =>
      [
        index + 1,
        "O",
        getHudlDdcat(play.down, play.distance, play.sequence),
        getFieldZone(play.ballOn),
        play.down,
        play.distance,
        formatBallOn(play.ballOn),
        play.hash,
        play.formation,
        play.motion,
        play.play,
        play.playType,
        play.result,
        play.yards,
        play.success ? "YES" : "NO",
        play.front,
        play.blitz,
        play.coverage,
        play.quarter,
        play.series,
        "",
      ]
        .map((value) => JSON.stringify(value ?? ""))
        .join(",")
    );

    exportFile(
      "hudl-tagging-export.csv",
      [headers.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  }
    return (
  <div className="fixed inset-0 overflow-hidden overscroll-none bg-zinc-100 p-2 text-zinc-900 touch-pan-x">
    <div className="mx-auto flex h-full max-w-[1366px] flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50 p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-zinc-500">Pat. D{form.playNumber}</div>
          <div className="flex flex-wrap gap-2">
            <button
  type="button"
  className={buttonClassName("default", false, "h-10 px-3 text-sm")}
  onClick={undoLastPlay}
  disabled={!undoHistory.length}
>
  Undo
</button>
            <button
              type="button"
              className={buttonClassName("blue", false, "h-10 px-3 text-sm")}
              onClick={onOpenDeveloper}
            >
              Developer
            </button>
            <button
              type="button"
              className={buttonClassName("default", false, "h-10 px-3 text-sm")}
              onClick={exportHudlCsv}
            >
              HUDL CSV
            </button>
            <button
              type="button"
              className={buttonClassName("default", false, "h-10 px-3 text-sm")}
              onClick={handleNewGame}
            >
              {confirmNewGame ? "Confirm New Game" : "New Game"}
            </button>
            {confirmNewGame ? (
              <button
                type="button"
                className={buttonClassName("default", false, "h-10 px-3 text-sm")}
                onClick={() => setConfirmNewGame(false)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid min-h-[338px] grid-cols-12 gap-3">
          <div className="col-span-3 h-full">
            <div className="grid h-full grid-cols-4 gap-3">
              {[
                "1",
                "2",
                "3",
                "-25",
                "4",
                "5",
                "6",
                "CLEAR",
                "7",
                "8",
                "9",
                "",
                "-",
                "0",
                "+",
                "",
                "",
                "",
                "",
                "",
              ].map((key, i) => {
                if (key === "") return <div key={`blank-left-${i}`} />;

                if (key === "CLEAR") {
                  return (
                    <KeyButton
                      key={key}
                      kind="green"
                      className="row-span-2 h-full min-h-[147px] text-lg"
                      onClick={() => {
                        if (activeInput === "ballOn") {
                          setBallOnEntry("-25");
                          updateField("ballOn", 25);
                          setBallOnFreshEdit(true);
                          return;
                        }

                        if (activeInput === "resultBallOn") {
                          setResultBallOnEntry(formatBallOn(form.ballOn));
                          setResultBallOnFreshEdit(true);
                          return;
                        }

                        setForm((prev) => ({
                          ...prev,
                          [activeInput]:
                            activeInput === "quarter" ||
                            activeInput === "series" ||
                            activeInput === "sequence" ||
                            activeInput === "down"
                              ? 1
                              : activeInput === "distance"
                                ? 10
                                : 0,
                        }));

                        if (activeInput === "distance") {
                            setDistanceFreshEdit(true);
                          }
                        
                      }}
                    >
                      <span className="text-center leading-tight">CLEAR</span>
                    </KeyButton>
                  );
                }

                if (key === "-25") {
                  return (
                    <KeyButton
                      key={key}
                      kind="danger"
                      className="h-[72px] text-xl"
                      onClick={() => {
                        if (activeInput === "ballOn") {
                          setBallOnEntry("-25");
                          updateField("ballOn", 25);
                          setBallOnFreshEdit(true);
                          return;
                        }

                        if (activeInput === "resultBallOn") {
                          setResultBallOnEntry("-25");
                          setResultBallOnFreshEdit(true);
                        }
                      }}
                    >
                      {key}
                    </KeyButton>
                  );
                }

                if (key === "-" || key === "+") {
                  return (
                    <KeyButton
                      key={`${key}-${i}`}
                      className="h-[72px] text-2xl"
                      onClick={() => {
                        if (activeInput === "ballOn" || activeInput === "resultBallOn") {
                          applySign(key as "+" | "-");
                        }
                      }}
                    >
                      {key}
                    </KeyButton>
                  );
                }

                return (
                  <KeyButton
                    key={`${key}-${i}`}
                    className="h-[72px] text-2xl"
                    onClick={() => appendDigit(key)}
                  >
                    {key}
                  </KeyButton>
                );
              })}
            </div>
          </div>

          <div className="col-span-4 self-start rounded-2xl border border-zinc-500 bg-gradient-to-br from-zinc-700 via-zinc-900 to-zinc-700 text-white shadow-2xl">
            <div className="p-3">
              <div className="grid grid-cols-3 gap-3">
                <div onClick={() => setActiveInput("down")}>
                  <StatBox label="DOWN" value={form.down} active={activeInput === "down"} />
                </div>
                <div
  onClick={() => {
    setActiveInput("distance");
    setDistanceFreshEdit(true);
  }}
>
  <StatBox
    label="DISTANCE"
    value={form.distance}
    active={activeInput === "distance"}
  />
</div>
                <div
                  onClick={() => {
                    setActiveInput("ballOn");
                    setBallOnFreshEdit(true);
                  }}
                >
                  <StatBox
                    label="BALL ON"
                    value={formatBallOn(form.ballOn)}
                    blue
                    active={activeInput === "ballOn"}
                  />
                </div>
                <div onClick={() => setActiveInput("quarter")}>
                  <StatBox
                    label="QUARTER"
                    value={form.quarter}
                    active={activeInput === "quarter"}
                  />
                </div>
                <div onClick={() => setActiveInput("series")}>
                  <StatBox
                    label="SERIES"
                    value={form.series}
                    active={activeInput === "series"}
                  />
                </div>
                <div onClick={() => setActiveInput("sequence")}>
                  <StatBox
                    label="SEQ"
                    value={form.sequence}
                    active={activeInput === "sequence"}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-lg font-medium uppercase tracking-wide text-zinc-100">
                    DOWN & DISTANCE
                  </div>
                  <div className="text-lg font-medium uppercase tracking-wide text-zinc-100">
                    FIELD POSITION
                  </div>
                </div>
                <div className="text-2xl font-bold uppercase leading-tight">
                  {summary.fieldPositionLabel}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-5 text-lg font-bold">
                <div className="flex items-center">
                  RUN:
                  <span className="ml-2 inline-flex min-w-[40px] items-center justify-center rounded-md bg-blue-600 px-2 py-1 text-xl text-white">
                    {summary.run}
                  </span>
                </div>
                <div className="flex items-center">
                  PASS:
                  <span className="ml-2 inline-flex min-w-[40px] items-center justify-center rounded-md bg-blue-600 px-2 py-1 text-xl text-white">
                    {summary.pass}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <MiniKpi label="Explosive Plays" value={summary.explosivePlays} />
                <MiniKpi label="Explosive %" value={summary.explosiveRateLabel} />
                <MiniKpi label="Run Explosives" value={summary.runExplosives} />
                <MiniKpi label="Pass Explosives" value={summary.passExplosives} />
              </div>
            </div>
          </div>

          <div className="col-span-1 flex h-full flex-col gap-2">
  {hashOptions.map((side) => (
    <KeyButton
      key={side}
      kind="blue"
      active={form.hash === side}
      className={[
        "h-[100px] text-3xl",
        goStatus.missing === "hash"
          ? "ring-4 ring-yellow-400"
          : "",
      ].join(" ")}
      onClick={() => updateField("hash", side)}
    >
      {side}
    </KeyButton>
  ))}
</div>

          <div className="col-span-4 h-full">
            <div className="mb-2 flex items-center justify-between px-2 text-lg font-bold">
              <div>
                EFF: <span>{summary.efficiencyLabel}</span>
              </div>
              <div>
                BLITZ: <span className="text-red-600">{summary.blitzLabel}</span>
              </div>
            </div>

            <div className="grid min-h-[250px] grid-cols-[3fr_1fr] gap-3">
              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
                  <KeyButton
                    key={`result-ball-on-${key}`}
                    className="h-[72px] text-2xl"
                    onClick={() => {
                      setActiveInput("resultBallOn");
                      appendDigit(key);
                    }}
                  >
                    {key}
                  </KeyButton>
                ))}

                <KeyButton
                  className="h-[72px] text-2xl"
                  onClick={() => {
                    setActiveInput("resultBallOn");
                    applySign("-");
                  }}
                >
                  -
                </KeyButton>

                <KeyButton
                  className="h-[72px] text-2xl"
                  onClick={() => {
                    setActiveInput("resultBallOn");
                    appendDigit("0");
                  }}
                >
                  0
                </KeyButton>

                <KeyButton
                  className="h-[72px] text-2xl"
                  onClick={() => {
                    setActiveInput("resultBallOn");
                    applySign("+");
                  }}
                >
                  +
                </KeyButton>
              </div>

              <div className="grid grid-rows-[auto_auto_1fr] gap-3">
                <div className={panelClassName("p-2")}>
                  <div className="text-sm font-semibold text-zinc-500">RESULT BALL ON</div>
                  <button
  type="button"
  onClick={() => {
    setActiveInput("resultBallOn");
    setResultBallOnFreshEdit(true);
  }}
  className={[
    "mt-2 flex h-12 w-full items-center justify-center rounded-xl border bg-white text-xl font-semibold text-zinc-700",
    activeInput === "resultBallOn"
      ? "border-yellow-400 ring-2 ring-yellow-400"
      : "border-zinc-300",
  ].join(" ")}
>
                    {resultBallOnEntry}
                  </button>
                </div>

                <div className={panelClassName("p-2")}>
                  <div className="text-sm font-semibold text-zinc-500">YARDS</div>
                  <button
                    type="button"
                    onClick={clearResultBallOn}
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl font-semibold text-zinc-700"
                  >
                    {String(parseBallOn(resultBallOnEntry) - Number(form.ballOn || 25))}
                  </button>
                </div>

                <KeyButton
                  kind="green"
                  active={goStatus.ready}
                  className={[
                    "h-full min-h-[72px] px-2 text-center",
                    goStatus.ready
                      ? "text-2xl ring-4 ring-green-400"
                      : "text-sm leading-tight",
                  ].join(" ")}
                  onClick={commitPlay}
                  disabled={!goStatus.ready}
                >
                  {goStatus.message}
                </KeyButton>
              </div>
            </div>
          </div>
        </div>

        <div className="h-8 shrink-0" />

        <div className="grid grid-cols-[1fr_460px] items-start gap-3">
          <div className={panelClassName("min-h-[116px]")}>
            <div className="border-b border-zinc-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Selected Play
            </div>
            <div className="px-4 py-4">
              <div className="text-2xl font-medium text-zinc-900">{selectedPlayText || " "}</div>
            </div>
          </div>

          <div
            className={[
              panelClassName(),
              goStatus.missing === "result" ? "ring-4 ring-yellow-400" : "",
            ].join(" ")}
          >
            <div className="border-b border-zinc-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Result
            </div>
            <div className="h-[100px] overflow-y-auto px-2 py-2">
              <div className="grid grid-cols-2 gap-1">
                {SYSTEM_RESULTS.map((item) => {
                  const active = item === form.result;
                  return (
                    <button
                      key={`result-${item}`}
                      type="button"
                      onClick={() => updateField("result", item)}
                      className={[
                        "flex w-full items-start justify-start rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50",
                        active ? "bg-blue-50 text-blue-700" : "",
                      ].join(" ")}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-9 gap-2">
          <PlaylistColumn
            label="Formation"
            items={libraries.formation}
            selectedValue={form.formation}
            onSelect={(value) => applyPlaylistSelection("formation", value)}
          />
          <PlaylistColumn
            label="Motion"
            items={libraries.motion}
            selectedValue={form.motion}
            onSelect={(value) => applyPlaylistSelection("motion", value)}
          />
          <PlaylistColumn
            label="Protection"
            items={libraries.protection}
            selectedValue={form.protection}
            onSelect={(value) => applyPlaylistSelection("protection", value)}
          />
          <PlaylistColumn
            label="Play"
            items={libraries.play}
            selectedValue={form.play}
            onSelect={(value) => applyPlaylistSelection("play", value)}
          />
          <div
            className={[
              "rounded-2xl",
              goStatus.missing === "concept" ? "ring-4 ring-yellow-400" : "",
            ].join(" ")}
          >
            <PlaylistColumn
              label="Run Concept"
              items={libraries.runConcept}
              selectedValue={form.runConcept}
              onSelect={(value) => applyPlaylistSelection("runConcept", value)}
            />
          </div>
          <div
            className={[
              "rounded-2xl",
              goStatus.missing === "concept" ? "ring-4 ring-yellow-400" : "",
            ].join(" ")}
          >
            <PlaylistColumn
              label="Pass Concept"
              items={libraries.passConcept}
              selectedValue={form.passConcept}
              onSelect={(value) => applyPlaylistSelection("passConcept", value)}
            />
          </div>
          <PlaylistColumn
            label="Front"
            items={libraries.front}
            selectedValue={form.front}
            onSelect={(value) => applyPlaylistSelection("front", value)}
          />
          <PlaylistColumn
            label="Blitz"
            items={libraries.blitz}
            selectedValue={form.blitz}
            onSelect={(value) => applyPlaylistSelection("blitz", value)}
          />
          <PlaylistColumn
            label="Coverage"
            items={libraries.coverage}
            selectedValue={form.coverage}
            onSelect={(value) => applyPlaylistSelection("coverage", value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-sm text-blue-600">
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => updateField("series", Number(form.series || 0) + 1)}
          >
            New Series
          </button>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => updateField("quarter", Math.min(Number(form.quarter || 1) + 1, 4))}
          >
            New Quarter
          </button>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={handleNewGame}
          >
            New Game
          </button>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={onPrintReports}
          >
            Print Reports
          </button>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={onOpenReports}
          >
            Reports
          </button>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={onOpenManager}
          >
            Call Sheet Manager
          </button>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={onOpenDeveloper}
          >
            Developer
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 8. CALL SHEET MANAGER SCREEN
// Library editing, saving, deleting, and export logic live here.
// =============================================================================

function CallSheetManager({
  libraries,
  setLibraries,
  onGoDashboard,
  onGoReports,
}: {
  libraries: Libraries;
  setLibraries: React.Dispatch<React.SetStateAction<Libraries>>;
  onGoDashboard: () => void;
  onGoReports: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<LibraryKey, string>>({
  formation: "",
  motion: "",
  protection: "",
  play: "",
  runConcept: "",
  passConcept: "",
  front: "",
  blitz: "",
  coverage: "",
});

  function updateDraft(name: LibraryKey, value: string): void {
    setDrafts((prev) => ({ ...prev, [name]: value }));
  }

  function saveLibraryColumn(name: LibraryKey): void {
    const values = drafts[name]
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (!values.length) return;

    setLibraries((prev) => ({
      ...prev,
      [name]: Array.from(new Set([...(prev[name] || []), ...values])).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      ),
    }));

    setDrafts((prev) => ({ ...prev, [name]: "" }));
  }

  function deleteLibraryValue(name: LibraryKey, value: string): void {
    setLibraries((prev) => ({
      ...prev,
      [name]: (prev[name] || []).filter((item) => item !== value),
    }));
  }

  function exportLocalCallSheet(): void {
    const headers = Object.keys(libraries) as LibraryKey[];
    const maxRows = Math.max(0, ...headers.map((key) => libraries[key].length));
    const rows = Array.from({ length: maxRows }, (_, idx) =>
      headers.map((key) => libraries[key][idx] || "")
    );

    exportFile(
      "local_call_sheet.csv",
      [headers.join(","), ...rows.map((row) => row.map((value) => JSON.stringify(value ?? "")).join(","))].join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-[1700px] space-y-4">
        <div className={panelClassName()}>
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="text-2xl font-bold text-zinc-900">Call Sheet Manager</div>
              <div className="text-sm text-zinc-500">
                Paste or type one value per line in each category column, save it, and delete values directly from the column list.
              </div>
            </div>
            <div className="flex gap-2">
              <div className="inline-flex h-10 items-center rounded-full border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium text-zinc-700">
                {Object.values(libraries).reduce((sum, values) => sum + values.length, 0)} items
              </div>
              <button
                type="button"
                className={buttonClassName("default", false, "h-10 px-3 text-sm")}
                onClick={exportLocalCallSheet}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <SpreadsheetColumn label="Formation" items={libraries.formation} draft={drafts.formation} onDraftChange={(value) => updateDraft("formation", value)} onSave={() => saveLibraryColumn("formation")} onDelete={(value) => deleteLibraryValue("formation", value)} />
          <SpreadsheetColumn label="Motion" items={libraries.motion} draft={drafts.motion} onDraftChange={(value) => updateDraft("motion", value)} onSave={() => saveLibraryColumn("motion")} onDelete={(value) => deleteLibraryValue("motion", value)} />
          <SpreadsheetColumn label="Protection" items={libraries.protection} draft={drafts.protection} onDraftChange={(value) => updateDraft("protection", value)} onSave={() => saveLibraryColumn("protection")} onDelete={(value) => deleteLibraryValue("protection", value)} />
          <SpreadsheetColumn label="Play" items={libraries.play} draft={drafts.play} onDraftChange={(value) => updateDraft("play", value)} onSave={() => saveLibraryColumn("play")} onDelete={(value) => deleteLibraryValue("play", value)} />
          <SpreadsheetColumn label="Run Concept" items={libraries.runConcept} draft={drafts.runConcept} onDraftChange={(value) => updateDraft("runConcept", value)} onSave={() => saveLibraryColumn("runConcept")} onDelete={(value) => deleteLibraryValue("runConcept", value)} />
          <SpreadsheetColumn label="Pass Concept" items={libraries.passConcept} draft={drafts.passConcept} onDraftChange={(value) => updateDraft("passConcept", value)} onSave={() => saveLibraryColumn("passConcept")} onDelete={(value) => deleteLibraryValue("passConcept", value)} />
          <SpreadsheetColumn label="Front" items={libraries.front} draft={drafts.front} onDraftChange={(value) => updateDraft("front", value)} onSave={() => saveLibraryColumn("front")} onDelete={(value) => deleteLibraryValue("front", value)} />
          <SpreadsheetColumn label="Blitz" items={libraries.blitz} draft={drafts.blitz} onDraftChange={(value) => updateDraft("blitz", value)} onSave={() => saveLibraryColumn("blitz")} onDelete={(value) => deleteLibraryValue("blitz", value)} />
          <SpreadsheetColumn label="Coverage" items={libraries.coverage} draft={drafts.coverage} onDraftChange={(value) => updateDraft("coverage", value)} onSave={() => saveLibraryColumn("coverage")} onDelete={(value) => deleteLibraryValue("coverage", value)} />
        </div>

        <BottomNav onGoDashboard={onGoDashboard} onGoManager={() => {}} onGoReports={onGoReports} />
      </div>
    </div>
  );
}

// =============================================================================
// 9. REPORT COMPONENTS AND REPORTS SCREEN
// Add report-only tables, aggregations, and report UI here.
// =============================================================================

type SortDirection = "asc" | "desc";

type TopTableSortKey =
  | "play"
  | "dimension"
  | "attempts"
  | "successRate"
  | "yards";

type ExplosiveTableSortKey =
  | "concept"
  | "attempts"
  | "explosives"
  | "explosiveRate"
  | "averageYards";

type EfficiencySortKey =
  | "down"
  | "bucket"
  | "front"
  | "blitz"
  | "coverage"
  | "runAttempts"
  | "runSuccessRate"
  | "passAttempts"
  | "passSuccessRate";

type SeriesSortKey =
  | "series"
  | "plays"
  | "yards"
  | "successRate"
  | "latestResult";

function compareReportValues(
  left: string | number,
  right: string | number,
  direction: SortDirection
): number {
  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: "base",
        });

  return direction === "asc" ? result : -result;
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <th className="p-2">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-semibold text-zinc-600 hover:text-blue-600"
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className="text-[10px] text-zinc-400">
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function PercentageBadge({
  value,
  threshold = 50,
}: {
  value: number;
  threshold?: number;
}) {
  const positive = value >= threshold;

  return (
    <span
      className={[
        "inline-flex min-w-[58px] items-center justify-center rounded-full border px-2 py-1 text-xs font-bold",
        positive
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      {formatPct(value)}
    </span>
  );
}

function ReportSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-zinc-300 pb-2">
      <div className="text-xl font-bold text-zinc-900">{title}</div>
      <div className="text-sm text-zinc-500">{subtitle}</div>
    </div>
  );
}

function TopTable({
  title,
  rows,
  dimensionLabel,
}: {
  title: string;
  rows: TopPlayRow[];
  dimensionLabel: string;
}) {
  const [sortKey, setSortKey] = useState<TopTableSortKey>("successRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function requestSort(nextKey: TopTableSortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "play" || nextKey === "dimension" ? "asc" : "desc");
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const left = sortKey === "dimension" ? a.dimension : a[sortKey];
      const right = sortKey === "dimension" ? b.dimension : b[sortKey];
      return compareReportValues(left, right, sortDirection);
    });
  }, [rows, sortKey, sortDirection]);

  return (
    <div className={panelClassName("h-[320px]")}>
      <div className="flex h-full flex-col p-4">
        <div className="mb-1 text-lg font-bold text-blue-600">{title}</div>
        <div className="mb-3 text-xs font-medium text-zinc-400">
          Minimum {TOP_REPORT_MIN_ATTEMPTS} attempts required. Ranked using a weighted blend of success rate, explosive rate, and average gain.
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="border-b text-zinc-500">
                <SortableHeader label="Play" active={sortKey === "play"} direction={sortDirection} onClick={() => requestSort("play")} />
                <SortableHeader label={dimensionLabel} active={sortKey === "dimension"} direction={sortDirection} onClick={() => requestSort("dimension")} />
                <SortableHeader label="Att" active={sortKey === "attempts"} direction={sortDirection} onClick={() => requestSort("attempts")} />
                <SortableHeader label="Success %" active={sortKey === "successRate"} direction={sortDirection} onClick={() => requestSort("successRate")} />
                <SortableHeader label="Yards" active={sortKey === "yards"} direction={sortDirection} onClick={() => requestSort("yards")} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? (
                sortedRows.map((item, idx) => (
                  <tr key={`${item.play}-${item.dimension}-${idx}`} className="border-b last:border-b-0">
                    <td className="p-2 font-medium text-zinc-800">{item.play}</td>
                    <td className="p-2">{item.dimension}</td>
                    <td className="p-2">{item.attempts}</td>
                    <td className="p-2"><PercentageBadge value={item.successRate} /></td>
                    <td className="p-2">{item.yards}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-zinc-400" colSpan={5}>
                    No rows have reached {TOP_REPORT_MIN_ATTEMPTS} attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExplosiveConceptTable({ rows }: { rows: AnalyticsGroupRow[] }) {
  const [sortKey, setSortKey] = useState<ExplosiveTableSortKey>("explosiveRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function requestSort(nextKey: ExplosiveTableSortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "concept" ? "asc" : "desc");
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const left = sortKey === "concept" ? a.values.concept || "—" : a[sortKey];
      const right = sortKey === "concept" ? b.values.concept || "—" : b[sortKey];
      return compareReportValues(left, right, sortDirection);
    });
  }, [rows, sortKey, sortDirection]);

  return (
    <div className={panelClassName("h-[320px]")}>
      <div className="flex h-full flex-col p-4">
        <div className="mb-1 text-lg font-bold text-blue-600">Top Explosive Concepts</div>
        <div className="mb-3 text-xs font-medium text-zinc-400">
          Minimum {TOP_REPORT_MIN_ATTEMPTS} attempts required. Weighted ranking is used behind the scenes and is not displayed as a column.
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="border-b text-zinc-500">
                <SortableHeader label="Concept" active={sortKey === "concept"} direction={sortDirection} onClick={() => requestSort("concept")} />
                <SortableHeader label="Att" active={sortKey === "attempts"} direction={sortDirection} onClick={() => requestSort("attempts")} />
                <SortableHeader label="Explosives" active={sortKey === "explosives"} direction={sortDirection} onClick={() => requestSort("explosives")} />
                <SortableHeader label="Explosive %" active={sortKey === "explosiveRate"} direction={sortDirection} onClick={() => requestSort("explosiveRate")} />
                <SortableHeader label="Avg Gain" active={sortKey === "averageYards"} direction={sortDirection} onClick={() => requestSort("averageYards")} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? (
                sortedRows.map((item, idx) => (
                  <tr key={`${item.values.concept || "concept"}-${idx}`} className="border-b last:border-b-0">
                    <td className="p-2 font-medium text-zinc-800">{item.values.concept || "—"}</td>
                    <td className="p-2">{item.attempts}</td>
                    <td className="p-2">{item.explosives}</td>
                    <td className="p-2"><PercentageBadge value={item.explosiveRate} threshold={20} /></td>
                    <td className="p-2">{item.averageYards.toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-zinc-400" colSpan={5}>
                    No concepts have reached {TOP_REPORT_MIN_ATTEMPTS} attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportsDashboard({
  plays,
  onGoDashboard,
  onGoManager,
}: {
  plays: Play[];
  onGoDashboard: () => void;
  onGoManager: () => void;
}) {
  const [efficiencySortKey, setEfficiencySortKey] = useState<EfficiencySortKey>("down");
  const [efficiencySortDirection, setEfficiencySortDirection] = useState<SortDirection>("asc");
  const [seriesSortKey, setSeriesSortKey] = useState<SeriesSortKey>("series");
  const [seriesSortDirection, setSeriesSortDirection] = useState<SortDirection>("asc");

  const topRunByFront = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Run", "front"), [plays]);
  const topPassConceptsByFormation = useMemo<TopPlayRow[]>(
    () => aggregateTopPassConceptsByFormation(plays),
    [plays]
  );
  const topRunByBlitz = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Run", "blitz"), [plays]);
  const topPassByCoverage = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Pass", "coverage"), [plays]);

  const explosiveConceptRows = useMemo<AnalyticsGroupRow[]>(
    () =>
      rankQualifiedAnalyticsRows(
        aggregateAnalytics(plays, {
          groupBy: ["concept"],
        }),
        5
      ),
    [plays]
  );

  const efficiencyRows = useMemo<EfficiencyRow[]>(() => {
    const grouped = new Map<string, EfficiencyRow>();

    plays.forEach((play) => {
      const key = `${play.down}|${getDistanceBucket(play.distance)}|${play.front || "—"}|${play.blitz?.trim() || "No Blitz"}|${play.coverage || "—"}`;
      const current = grouped.get(key) || {
        down: play.down,
        bucket: getDistanceBucket(play.distance),
        front: play.front || "—",
        blitz: play.blitz?.trim() || "No Blitz",
        coverage: play.coverage || "—",
        runAttempts: 0,
        runSuccess: 0,
        passAttempts: 0,
        passSuccess: 0,
      };

      if (play.playType === "Run") {
        current.runAttempts += 1;
        current.runSuccess += play.success ? 1 : 0;
      }

      if (play.playType === "Pass") {
        current.passAttempts += 1;
        current.passSuccess += play.success ? 1 : 0;
      }

      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [plays]);

  const seriesRows = useMemo<SeriesRow[]>(() => {
    const grouped = new Map<
      number,
      { series: number; plays: number; yards: number; success: number; results: string[] }
    >();

    plays.forEach((play) => {
      const key = Number(play.series || 0);
      const current = grouped.get(key) || {
        series: key,
        plays: 0,
        yards: 0,
        success: 0,
        results: [],
      };

      current.plays += 1;
      current.yards += Number(play.yards || 0);
      current.success += play.success ? 1 : 0;
      if (play.result) current.results.push(play.result);

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map((item) => ({
      series: item.series,
      plays: item.plays,
      yards: item.yards,
      success: item.success,
      successRate: item.plays ? (item.success / item.plays) * 100 : 0,
      latestResult: item.results[item.results.length - 1] || "",
    }));
  }, [plays]);

  const lastUpdatedLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    [plays]
  );

  const situationalSampleSummary = useMemo(() => {
    const thirdDownOpportunities = plays.filter(
      (play) => Number(play.down || 0) === 3
    ).length;
    const redZoneOpportunities = plays.filter(
      (play) => Number(play.ballOn || 0) >= 76
    ).length;

    return {
      thirdDownOpportunities,
      thirdDownLabel: getSituationalSampleLabel(thirdDownOpportunities),
      redZoneOpportunities,
      redZoneLabel: getSituationalSampleLabel(redZoneOpportunities),
    };
  }, [plays]);

  function requestEfficiencySort(nextKey: EfficiencySortKey): void {
    if (nextKey === efficiencySortKey) {
      setEfficiencySortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setEfficiencySortKey(nextKey);
    setEfficiencySortDirection(
      ["bucket", "front", "blitz", "coverage"].includes(nextKey) ? "asc" : "desc"
    );
  }

  function requestSeriesSort(nextKey: SeriesSortKey): void {
    if (nextKey === seriesSortKey) {
      setSeriesSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSeriesSortKey(nextKey);
    setSeriesSortDirection(nextKey === "latestResult" ? "asc" : "desc");
  }

  const sortedEfficiencyRows = useMemo(() => {
    return [...efficiencyRows].sort((a, b) => {
      const runRateA = a.runAttempts ? (a.runSuccess / a.runAttempts) * 100 : 0;
      const runRateB = b.runAttempts ? (b.runSuccess / b.runAttempts) * 100 : 0;
      const passRateA = a.passAttempts ? (a.passSuccess / a.passAttempts) * 100 : 0;
      const passRateB = b.passAttempts ? (b.passSuccess / b.passAttempts) * 100 : 0;

      const valuesA: Record<EfficiencySortKey, string | number> = {
        down: a.down,
        bucket: a.bucket,
        front: a.front,
        blitz: a.blitz,
        coverage: a.coverage,
        runAttempts: a.runAttempts,
        runSuccessRate: runRateA,
        passAttempts: a.passAttempts,
        passSuccessRate: passRateA,
      };
      const valuesB: Record<EfficiencySortKey, string | number> = {
        down: b.down,
        bucket: b.bucket,
        front: b.front,
        blitz: b.blitz,
        coverage: b.coverage,
        runAttempts: b.runAttempts,
        runSuccessRate: runRateB,
        passAttempts: b.passAttempts,
        passSuccessRate: passRateB,
      };

      return compareReportValues(
        valuesA[efficiencySortKey],
        valuesB[efficiencySortKey],
        efficiencySortDirection
      );
    });
  }, [efficiencyRows, efficiencySortKey, efficiencySortDirection]);

  const sortedSeriesRows = useMemo(() => {
    return [...seriesRows].sort((a, b) =>
      compareReportValues(a[seriesSortKey], b[seriesSortKey], seriesSortDirection)
    );
  }, [seriesRows, seriesSortKey, seriesSortDirection]);

  function exportReportsCsv(): void {
    const sections: string[] = [];

    function addSection(title: string, headers: string[], rows: Array<Array<string | number>>): void {
      sections.push(JSON.stringify(title));
      sections.push(headers.map((value) => JSON.stringify(value)).join(","));
      rows.forEach((row) => {
        sections.push(row.map((value) => JSON.stringify(value ?? "")).join(","));
      });
      sections.push("");
    }

    addSection(
      "Top Explosive Concepts",
      ["Concept", "Attempts", "Explosives", "Explosive %", "Average Gain"],
      explosiveConceptRows.map((row) => [
        row.values.concept || "—",
        row.attempts,
        row.explosives,
        Number(row.explosiveRate.toFixed(1)),
        Number(row.averageYards.toFixed(1)),
      ])
    );

    [
      ["Top Run Plays vs Fronts", topRunByFront, "Front"],
      ["Top Pass Concepts by Formation", topPassConceptsByFormation, "Formation"],
      ["Top Run Plays vs Blitz", topRunByBlitz, "Blitz"],
      ["Top Pass Plays vs Coverage", topPassByCoverage, "Coverage"],
    ].forEach(([title, reportRows, dimension]) => {
      const rows = reportRows as TopPlayRow[];
      addSection(
        String(title),
        ["Play", String(dimension), "Attempts", "Success %", "Yards"],
        rows.map((row) => [
          row.play,
          row.dimension,
          row.attempts,
          Number(row.successRate.toFixed(1)),
          row.yards,
        ])
      );
    });

    addSection(
      "Run vs Pass Efficiency",
      ["Down", "Distance", "Front", "Blitz", "Coverage", "Run Attempts", "Run Success %", "Pass Attempts", "Pass Success %"],
      efficiencyRows.map((row) => [
        row.down,
        row.bucket,
        row.front,
        row.blitz,
        row.coverage,
        row.runAttempts,
        Number((row.runAttempts ? (row.runSuccess / row.runAttempts) * 100 : 0).toFixed(1)),
        row.passAttempts,
        Number((row.passAttempts ? (row.passSuccess / row.passAttempts) * 100 : 0).toFixed(1)),
      ])
    );

    addSection(
      "Drive Series Analytics",
      ["Series", "Plays", "Yards", "Success %", "Latest Result"],
      seriesRows.map((row) => [
        row.series,
        row.plays,
        row.yards,
        Number(row.successRate.toFixed(1)),
        row.latestResult,
      ])
    );

    exportFile(
      "game-reports-export.csv",
      sections.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className={panelClassName()}>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-bold text-zinc-900">Reports</div>
              <div className="text-sm text-zinc-500">
                Live insights and analytics from your tracked plays, including defensive looks.
              </div>
              <div className="mt-1 text-xs font-medium text-zinc-400">
                Last Updated: {lastUpdatedLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={exportReportsCsv}
              className={buttonClassName("blue", false, "h-10 px-4 text-sm")}
            >
              Export Reports CSV
            </button>
          </div>
        </div>

        <ReportSectionHeader
          title="Explosive Play Analytics"
          subtitle="Identify the concepts creating the highest rate of chunk plays and touchdowns."
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ExplosiveConceptTable rows={explosiveConceptRows} />
        </div>

        <ReportSectionHeader
          title="Offensive Tendencies"
          subtitle="Compare the most successful run and pass calls against common defensive structures."
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TopTable title="Top 3 Run Plays vs Fronts" rows={topRunByFront} dimensionLabel="Front" />
          <TopTable title="Top 3 Pass Concepts by Formation" rows={topPassConceptsByFormation} dimensionLabel="Formation" />
          <TopTable title="Top 3 Run Plays vs Blitz" rows={topRunByBlitz} dimensionLabel="Blitz" />
          <TopTable title="Top 3 Pass Plays vs Coverage" rows={topPassByCoverage} dimensionLabel="Coverage" />
        </div>

        <ReportSectionHeader
          title="Situational Analytics"
          subtitle="Review efficiency by game situation and evaluate production across each drive series. Results remain visible at every sample size; labels indicate how strongly they should be interpreted."
        />

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            <span className="font-semibold">3rd Down:</span>{" "}
            {situationalSampleSummary.thirdDownOpportunities} opportunities · {situationalSampleSummary.thirdDownLabel}
          </div>
          <div className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            <span className="font-semibold">Red Zone:</span>{" "}
            {situationalSampleSummary.redZoneOpportunities} opportunities · {situationalSampleSummary.redZoneLabel}
          </div>
        </div>

        <div className={panelClassName("h-[320px]")}>
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 text-lg font-bold text-blue-600">
              Run vs Pass Efficiency by Down, Distance, Front, Blitz, Coverage
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50">
                  <tr className="border-b text-zinc-500">
                    <SortableHeader label="Down" active={efficiencySortKey === "down"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("down")} />
                    <SortableHeader label="Distance" active={efficiencySortKey === "bucket"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("bucket")} />
                    <SortableHeader label="Front" active={efficiencySortKey === "front"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("front")} />
                    <SortableHeader label="Blitz" active={efficiencySortKey === "blitz"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("blitz")} />
                    <SortableHeader label="Coverage" active={efficiencySortKey === "coverage"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("coverage")} />
                    <SortableHeader label="Run Att" active={efficiencySortKey === "runAttempts"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("runAttempts")} />
                    <SortableHeader label="Run Success %" active={efficiencySortKey === "runSuccessRate"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("runSuccessRate")} />
                    <SortableHeader label="Pass Att" active={efficiencySortKey === "passAttempts"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("passAttempts")} />
                    <SortableHeader label="Pass Success %" active={efficiencySortKey === "passSuccessRate"} direction={efficiencySortDirection} onClick={() => requestEfficiencySort("passSuccessRate")} />
                  </tr>
                </thead>
                <tbody>
                  {sortedEfficiencyRows.length ? (
                    sortedEfficiencyRows.map((item, idx) => {
                      const runRate = item.runAttempts ? (item.runSuccess / item.runAttempts) * 100 : 0;
                      const passRate = item.passAttempts ? (item.passSuccess / item.passAttempts) * 100 : 0;

                      return (
                        <tr key={`${item.down}-${item.bucket}-${item.front}-${item.blitz}-${item.coverage}-${idx}`} className="border-b last:border-b-0">
                          <td className="p-2">{item.down}</td>
                          <td className="p-2">{item.bucket}</td>
                          <td className="p-2">{item.front}</td>
                          <td className="p-2">{item.blitz}</td>
                          <td className="p-2">{item.coverage}</td>
                          <td className="p-2">{item.runAttempts}</td>
                          <td className="p-2"><PercentageBadge value={runRate} /></td>
                          <td className="p-2">{item.passAttempts}</td>
                          <td className="p-2"><PercentageBadge value={passRate} /></td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-3 text-zinc-400" colSpan={9}>No efficiency data yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={panelClassName("h-[320px]")}>
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 text-lg font-bold text-blue-600">Drive Series Analytics</div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50">
                  <tr className="border-b text-zinc-500">
                    <SortableHeader label="Series" active={seriesSortKey === "series"} direction={seriesSortDirection} onClick={() => requestSeriesSort("series")} />
                    <SortableHeader label="Plays" active={seriesSortKey === "plays"} direction={seriesSortDirection} onClick={() => requestSeriesSort("plays")} />
                    <SortableHeader label="Yards" active={seriesSortKey === "yards"} direction={seriesSortDirection} onClick={() => requestSeriesSort("yards")} />
                    <SortableHeader label="Success %" active={seriesSortKey === "successRate"} direction={seriesSortDirection} onClick={() => requestSeriesSort("successRate")} />
                    <SortableHeader label="Latest Result" active={seriesSortKey === "latestResult"} direction={seriesSortDirection} onClick={() => requestSeriesSort("latestResult")} />
                  </tr>
                </thead>
                <tbody>
                  {sortedSeriesRows.length ? (
                    sortedSeriesRows.map((item) => (
                      <tr key={`series-${item.series}`} className="border-b last:border-b-0">
                        <td className="p-2">{item.series}</td>
                        <td className="p-2">{item.plays}</td>
                        <td className="p-2">{item.yards}</td>
                        <td className="p-2"><PercentageBadge value={item.successRate} /></td>
                        <td className="p-2">{item.latestResult}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-3 text-zinc-400" colSpan={5}>No series data yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <BottomNav onGoDashboard={onGoDashboard} onGoManager={onGoManager} onGoReports={() => {}} />
      </div>
    </div>
  );
}


// =============================================================================
// 10. DEVELOPER TEST MODE
// Fixed regression datasets, season loading, random stress generation, and
// automatic analytics verification live here.
// =============================================================================

type TestDatasetKind =
  | "balanced"
  | "airRaid"
  | "runHeavy"
  | "redZone"
  | "thirdDown"
  | "blitzHeavy";

type TestDatasetMeta = {
  kind: TestDatasetKind | "season" | "random";
  label: string;
  createdAt: string;
  games: number;
  plays: number;
};

type VerificationResult = {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
};

const TEST_DATASETS: Array<{
  kind: TestDatasetKind;
  label: string;
  description: string;
}> = [
  { kind: "balanced", label: "Balanced Regression Game", description: "Full report coverage with runs, passes, explosives, third downs, red zone, touchdowns, a turnover, and a punt." },
  { kind: "airRaid", label: "College Air Raid", description: "Pass-heavy game emphasizing concepts by formation and coverage." },
  { kind: "runHeavy", label: "Run Heavy", description: "Run-focused game emphasizing fronts, blitzes, and explosive runs." },
  { kind: "redZone", label: "Red Zone", description: "Short-field drives built to stress red-zone opportunity and scoring logic." },
  { kind: "thirdDown", label: "Third Down", description: "High volume of third-down opportunities across distance buckets." },
  { kind: "blitzHeavy", label: "Blitz Heavy", description: "Defensive pressure dataset emphasizing run and pass performance against blitzes." },
];

function getQuarterForSequence(sequence: number, totalPlays: number): number {
  return Math.min(4, Math.max(1, Math.ceil((sequence / Math.max(totalPlays, 1)) * 4)));
}

function makeTestPlay(
  index: number,
  overrides: Partial<Play>,
  gamePrefix: string
): Play {
  const base = seedPlay({
    id: `${gamePrefix}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    playNumber: 9000000 + index + 1,
    sequence: index + 1,
    quarter: 1,
    series: Math.floor(index / 7) + 1,
    driveId: `${gamePrefix}-drive-${Math.floor(index / 7) + 1}`,
    driveResult: "",
  });
  const play = { ...base, ...overrides };
  return { ...play, success: getSuccess(play) };
}

function generateFixedTestGame(
  kind: TestDatasetKind = "balanced",
  gameNumber = 1
): Play[] {
  const gamePrefix = `test-${kind}-g${gameNumber}`;
  const plays: Play[] = [];
  const add = (overrides: Partial<Play>) => {
    const next = makeTestPlay(plays.length, overrides, gamePrefix);
    plays.push(next);
  };

  const profiles: Record<TestDatasetKind, { runPct: number; blitzPct: number; redZonePct: number; thirdDownPct: number }> = {
    balanced: { runPct: 0.55, blitzPct: 0.30, redZonePct: 0.18, thirdDownPct: 0.18 },
    airRaid: { runPct: 0.28, blitzPct: 0.36, redZonePct: 0.16, thirdDownPct: 0.20 },
    runHeavy: { runPct: 0.76, blitzPct: 0.28, redZonePct: 0.18, thirdDownPct: 0.16 },
    redZone: { runPct: 0.58, blitzPct: 0.34, redZonePct: 0.72, thirdDownPct: 0.22 },
    thirdDown: { runPct: 0.46, blitzPct: 0.38, redZonePct: 0.14, thirdDownPct: 0.50 },
    blitzHeavy: { runPct: 0.52, blitzPct: 0.78, redZonePct: 0.18, thirdDownPct: 0.24 },
  };
  const profile = profiles[kind];
  const total = kind === "redZone" ? 56 : 64;

  for (let i = 0; i < total; i += 1) {
    const isRun = (i % 100) / 100 < profile.runPct || i % 7 < Math.round(profile.runPct * 7);
    const isThirdDown = i % Math.max(2, Math.round(1 / profile.thirdDownPct)) === 0;
    const inRedZone = i % Math.max(2, Math.round(1 / profile.redZonePct)) === 1;
    const blitzed = i % Math.max(2, Math.round(1 / profile.blitzPct)) === 0;
    const series = Math.floor(i / 7) + 1;
    const down = isThirdDown ? 3 : ((i % 2) + 1);
    const distance = isThirdDown ? [2, 5, 8, 11][i % 4] : down === 1 ? 10 : [3, 5, 7][i % 3];
    const ballOn = inRedZone ? 80 + (i % 16) : 20 + ((i * 7) % 56);
    const hash: HashOption = (["L", "M", "R"] as HashOption[])[i % 3];
    const formation = isRun ? (i % 5 === 0 ? "Doubles" : "Trips") : (i % 4 === 0 ? "Doubles" : "Trips");
    const front = i % 6 === 0 ? "UNDER" : "OVER";
    const blitz = blitzed ? (i % 3 === 0 ? "MIKE" : "EDGE") : "";
    const coverage = i % 5 === 0 ? "Quarters" : blitzed ? "Cover 1" : "Cover 3";

    if (isRun) {
      const primary = i % 4 !== 0;
      const play = primary ? "17" : "16";
      const concept = primary ? "WZ" : "POWER";
      let yards = primary ? [4, 6, 8, 11, 5, 14][i % 6] : [1, 3, 5, 7][i % 4];
      if (kind === "runHeavy" && primary && i % 8 === 0) yards = 18;
      if (inRedZone && i % 13 === 0) yards = Math.max(1, 100 - ballOn);
      const touchdown = inRedZone && yards >= 100 - ballOn;
      add({
        quarter: getQuarterForSequence(i + 1, total), series, down, distance, ballOn, hash,
        playType: "Run", formation, motion: i % 4 === 0 ? "JET" : "NONE", protection: "",
        play, runConcept: concept, passConcept: "", concept, front, blitz, coverage,
        result: touchdown ? "Rush TD" : yards === 0 ? "No Gain" : "Rush", yards,
        driveResult: touchdown ? "Touchdown" : "",
      });
    } else {
      const quick = i % 3 !== 0;
      const play = quick ? "GOOSE" : "RIVER";
      const concept = quick ? "QUICK" : "3 LEVEL";
      const complete = i % 5 !== 1;
      let yards = complete ? (quick ? [5, 7, 9, 12, 16][i % 5] : [11, 16, 20, 24][i % 4]) : 0;
      if (kind === "airRaid" && !quick && complete) yards += 5;
      const interception = kind === "balanced" && i === 51;
      const touchdown = !interception && complete && inRedZone && yards >= 100 - ballOn;
      add({
        quarter: getQuarterForSequence(i + 1, total), series, down, distance, ballOn, hash,
        playType: "Pass", formation, motion: i % 3 === 0 ? "ORBIT" : "NONE", protection: "60",
        play, runConcept: "", passConcept: concept, concept, front, blitz, coverage,
        result: interception ? "Interception" : touchdown ? "Complete TD" : complete ? "Complete" : "Incomplete",
        yards: interception ? 0 : yards,
        driveResult: interception ? "Turnover" : touchdown ? "Touchdown" : "",
      });
    }
  }

  if (plays.length) {
    plays[plays.length - 1] = {
      ...plays[plays.length - 1],
      driveResult: plays[plays.length - 1].driveResult || "Punt",
    };
  }
  return plays;
}

function generateTestSeason(games = 10): Play[] {
  const kinds: TestDatasetKind[] = ["balanced", "airRaid", "runHeavy", "redZone", "thirdDown", "blitzHeavy"];
  return Array.from({ length: games }, (_, index) =>
    generateFixedTestGame(kinds[index % kinds.length], index + 1).map((play) => ({
      ...play,
      series: play.series + index * 20,
      driveId: `season-g${index + 1}-${play.driveId}`,
      playNumber: 9100000 + index * 1000 + play.sequence,
    }))
  ).flat();
}

function generateRandomTestGame(options: {
  plays: number;
  runPct: number;
  blitzPct: number;
  successPct: number;
}): Play[] {
  const total = Math.max(20, Math.min(160, Math.round(options.plays)));
  const result: Play[] = [];
  for (let i = 0; i < total; i += 1) {
    const isRun = Math.random() * 100 < options.runPct;
    const blitzed = Math.random() * 100 < options.blitzPct;
    const successful = Math.random() * 100 < options.successPct;
    const down = Math.random() < 0.22 ? 3 : Math.random() < 0.55 ? 1 : 2;
    const distance = down === 1 ? 10 : [2, 4, 6, 9, 12][Math.floor(Math.random() * 5)];
    const ballOn = 15 + Math.floor(Math.random() * 81);
    const maxGain = Math.max(1, 100 - ballOn);
    let yards = successful ? (isRun ? 4 + Math.floor(Math.random() * 15) : 6 + Math.floor(Math.random() * 24)) : Math.floor(Math.random() * 3);
    yards = Math.min(yards, maxGain);
    const touchdown = yards >= maxGain;
    const concept = isRun ? (Math.random() < 0.7 ? "WZ" : "POWER") : (Math.random() < 0.65 ? "QUICK" : "3 LEVEL");
    const play = isRun ? (concept === "WZ" ? "17" : "16") : (concept === "QUICK" ? "GOOSE" : "RIVER");
    const base = makeTestPlay(i, {
      quarter: getQuarterForSequence(i + 1, total),
      series: Math.floor(i / 7) + 1,
      down, distance, ballOn,
      hash: (["L", "M", "R"] as HashOption[])[i % 3],
      playType: isRun ? "Run" : "Pass",
      formation: Math.random() < 0.7 ? "Trips" : "Doubles",
      motion: Math.random() < 0.25 ? "JET" : "NONE",
      protection: isRun ? "" : "60",
      play,
      runConcept: isRun ? concept : "",
      passConcept: isRun ? "" : concept,
      concept,
      front: Math.random() < 0.7 ? "OVER" : "UNDER",
      blitz: blitzed ? (Math.random() < 0.5 ? "MIKE" : "EDGE") : "",
      coverage: blitzed ? "Cover 1" : Math.random() < 0.7 ? "Cover 3" : "Quarters",
      result: isRun ? (touchdown ? "Rush TD" : yards === 0 ? "No Gain" : "Rush") : touchdown ? "Complete TD" : successful ? "Complete" : "Incomplete",
      yards,
      driveResult: touchdown ? "Touchdown" : "",
    }, "test-random");
    result.push(base);
  }
  return result;
}

function saveTestPlays(plays: Play[], meta: TestDatasetMeta): void {
  const last = plays[plays.length - 1];
  const nextForm: PlayForm = last
    ? {
        ...defaultForm,
        playNumber: last.playNumber + 1,
        quarter: last.quarter,
        series: last.series + 1,
        sequence: last.sequence + 1,
        ballOn: 25,
        driveId: `${meta.kind}-next-drive`,
      }
    : defaultForm;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ plays, form: nextForm, undoHistory: [] }));
  window.localStorage.setItem(TEST_DATASET_KEY, JSON.stringify(meta));
}

function verifyTestAnalytics(plays: Play[]): VerificationResult[] {
  const topRunFront = aggregateTopPlays(plays, "Run", "front")[0];
  const topPassFormation = aggregateTopPassConceptsByFormation(plays)[0];
  const topRunBlitz = aggregateTopPlays(plays, "Run", "blitz")[0];
  const topPassCoverage = aggregateTopPlays(plays, "Pass", "coverage")[0];
  const explosive = rankQualifiedAnalyticsRows(aggregateAnalytics(plays, { groupBy: ["concept"] }), 5)[0];
  const thirdDowns = plays.filter((play) => play.down === 3);
  const redZone = plays.filter((play) => play.ballOn >= 76);
  const touchdowns = plays.filter((play) => ["Rush TD", "Complete TD"].includes(play.result)).length;
  const turnoverCount = plays.filter((play) => ["Interception", "Fumble Lost"].includes(play.result)).length;

  const tests: VerificationResult[] = [
    { name: "Minimum report qualification", expected: `Every displayed row has ${TOP_REPORT_MIN_ATTEMPTS}+ attempts`, actual: [
        ...aggregateTopPlays(plays, "Run", "front"), ...aggregateTopPassConceptsByFormation(plays),
        ...aggregateTopPlays(plays, "Run", "blitz"), ...aggregateTopPlays(plays, "Pass", "coverage")
      ].every((row) => row.attempts >= TOP_REPORT_MIN_ATTEMPTS) ? "All rows qualified" : "Unqualified row found", passed: [
        ...aggregateTopPlays(plays, "Run", "front"), ...aggregateTopPassConceptsByFormation(plays),
        ...aggregateTopPlays(plays, "Run", "blitz"), ...aggregateTopPlays(plays, "Pass", "coverage")
      ].every((row) => row.attempts >= TOP_REPORT_MIN_ATTEMPTS) },
    { name: "Top run vs front", expected: "A qualified result", actual: topRunFront ? `${topRunFront.play} vs ${topRunFront.dimension} (${topRunFront.attempts})` : "No result", passed: Boolean(topRunFront) },
    { name: "Top pass concept by formation", expected: "A qualified result", actual: topPassFormation ? `${topPassFormation.play} from ${topPassFormation.dimension} (${topPassFormation.attempts})` : "No result", passed: Boolean(topPassFormation) },
    { name: "Top run vs blitz", expected: "A qualified result", actual: topRunBlitz ? `${topRunBlitz.play} vs ${topRunBlitz.dimension || "No Blitz"} (${topRunBlitz.attempts})` : "No result", passed: Boolean(topRunBlitz) },
    { name: "Top pass vs coverage", expected: "A qualified result", actual: topPassCoverage ? `${topPassCoverage.play} vs ${topPassCoverage.dimension} (${topPassCoverage.attempts})` : "No result", passed: Boolean(topPassCoverage) },
    { name: "Explosive concept report", expected: "A qualified concept", actual: explosive ? `${explosive.values.concept} (${formatPct(explosive.explosiveRate)})` : "No result", passed: Boolean(explosive) },
    { name: "Third-down sample", expected: "At least 8 opportunities", actual: `${thirdDowns.length} · ${getSituationalSampleLabel(thirdDowns.length)}`, passed: thirdDowns.length >= 8 },
    { name: "Red-zone sample", expected: "At least 8 opportunities", actual: `${redZone.length} · ${getSituationalSampleLabel(redZone.length)}`, passed: redZone.length >= 8 },
    { name: "Touchdown outcomes", expected: "At least 1 touchdown", actual: `${touchdowns}`, passed: touchdowns > 0 },
    { name: "Turnover coverage", expected: "At least 1 turnover in balanced/season data", actual: `${turnoverCount}`, passed: turnoverCount > 0 || plays.length < 60 },
    { name: "Success flags", expected: "Every play has a boolean success value", actual: plays.every((play) => typeof play.success === "boolean") ? "Valid" : "Invalid", passed: plays.every((play) => typeof play.success === "boolean") },
    { name: "Field position bounds", expected: "Ball On values from 1 through 99", actual: plays.every((play) => play.ballOn >= 1 && play.ballOn <= 99) ? "Valid" : "Invalid", passed: plays.every((play) => play.ballOn >= 1 && play.ballOn <= 99) },
  ];
  return tests;
}

function DeveloperTestScreen({
  libraries,
  onGoDashboard,
  onGoReports,
  onDataChanged,
}: {
  libraries: Libraries;
  onGoDashboard: () => void;
  onGoReports: () => void;
  onDataChanged: () => void;
}) {
  const [selectedKind, setSelectedKind] = useState<TestDatasetKind>("balanced");
  const [currentPlays, setCurrentPlays] = useState<Play[]>([]);
  const [meta, setMeta] = useState<TestDatasetMeta | null>(null);
  const [verification, setVerification] = useState<VerificationResult[]>([]);
  const [status, setStatus] = useState("Ready. Loading a test dataset replaces current game data but preserves call-sheet libraries.");
  const [confirmClear, setConfirmClear] = useState(false);
  const [seasonGames, setSeasonGames] = useState(10);
  const [randomOptions, setRandomOptions] = useState({ plays: 70, runPct: 55, blitzPct: 30, successPct: 52 });

  function refresh(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { plays?: Play[] }) : {};
      const nextPlays = Array.isArray(parsed.plays) ? parsed.plays : [];
      setCurrentPlays(nextPlays);
      const metaRaw = window.localStorage.getItem(TEST_DATASET_KEY);
      setMeta(metaRaw ? (JSON.parse(metaRaw) as TestDatasetMeta) : null);
    } catch {
      setCurrentPlays([]);
      setMeta(null);
    }
  }

  useEffect(() => { refresh(); }, []);

  function loadDataset(kind: TestDatasetKind): void {
    const dataset = generateFixedTestGame(kind);
    const label = TEST_DATASETS.find((item) => item.kind === kind)?.label || kind;
    const nextMeta: TestDatasetMeta = { kind, label, createdAt: new Date().toISOString(), games: 1, plays: dataset.length };
    saveTestPlays(dataset, nextMeta);
    setCurrentPlays(dataset); setMeta(nextMeta); setVerification([]); setStatus(`${label} loaded with ${dataset.length} plays.`); onDataChanged();
  }

  function loadSeason(): void {
    const dataset = generateTestSeason(seasonGames);
    const nextMeta: TestDatasetMeta = { kind: "season", label: `${seasonGames}-Game Test Season`, createdAt: new Date().toISOString(), games: seasonGames, plays: dataset.length };
    saveTestPlays(dataset, nextMeta);
    setCurrentPlays(dataset); setMeta(nextMeta); setVerification([]); setStatus(`${seasonGames}-game season loaded with ${dataset.length} plays.`); onDataChanged();
  }

  function loadRandom(): void {
    const dataset = generateRandomTestGame(randomOptions);
    const nextMeta: TestDatasetMeta = { kind: "random", label: "Random Stress Game", createdAt: new Date().toISOString(), games: 1, plays: dataset.length };
    saveTestPlays(dataset, nextMeta);
    setCurrentPlays(dataset); setMeta(nextMeta); setVerification([]); setStatus(`Random stress game loaded with ${dataset.length} plays.`); onDataChanged();
  }

  function clearGameData(): void {
    if (!confirmClear) { setConfirmClear(true); setStatus("Click Clear Game Data again to confirm. Libraries will remain saved."); return; }
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(TEST_DATASET_KEY);
    setCurrentPlays([]); setMeta(null); setVerification([]); setConfirmClear(false); setStatus("Game, drive, and report data cleared. Call-sheet libraries were preserved."); onDataChanged();
  }

  function runVerification(): void {
    const tests = verifyTestAnalytics(currentPlays);
    setVerification(tests);
    const passed = tests.filter((test) => test.passed).length;
    setStatus(`Verification complete: ${passed} of ${tests.length} tests passed.`);
  }

  function exportVerification(): void {
    const tests = verification.length ? verification : verifyTestAnalytics(currentPlays);
    const payload = {
      application: "Score From Far GameDay",
      version: APP_VERSION,
      generatedAt: new Date().toISOString(),
      dataset: meta,
      librariesPreserved: Object.values(libraries).reduce((sum, values) => sum + values.length, 0),
      summary: { tests: tests.length, passed: tests.filter((test) => test.passed).length, failed: tests.filter((test) => !test.passed).length },
      results: tests,
    };
    exportFile(`score-from-far-test-results-v${APP_VERSION}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  const passedCount = verification.filter((test) => test.passed).length;

  return (
    <div className="min-h-screen bg-zinc-100 p-3 text-zinc-900">
      <div className="mx-auto max-w-[1200px] space-y-4 rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="text-2xl font-bold">Developer / Test Mode</div><div className="text-sm text-zinc-500">Score From Far GameDay v{APP_VERSION}</div></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClassName("default", false, "h-10 px-4")} onClick={onGoDashboard}>Dashboard</button>
            <button type="button" className={buttonClassName("blue", false, "h-10 px-4")} onClick={onGoReports}>Open Reports</button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatBox label="Loaded Dataset" value={meta?.label || "None"} blue />
          <StatBox label="Games" value={meta?.games || 0} />
          <StatBox label="Plays" value={currentPlays.length} />
          <StatBox label="Verification" value={verification.length ? `${passedCount}/${verification.length} passed` : "Not run"} />
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" aria-live="polite">{status}</div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={panelClassName("p-4")}>
            <div className="mb-3 text-lg font-bold">Fixed Regression Dataset</div>
            <label className="block text-sm font-medium">Dataset</label>
            <select value={selectedKind} onChange={(event) => setSelectedKind(event.target.value as TestDatasetKind)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2">
              {TEST_DATASETS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
            </select>
            <div className="mt-2 min-h-10 text-sm text-zinc-500">{TEST_DATASETS.find((item) => item.kind === selectedKind)?.description}</div>
            <button type="button" className={buttonClassName("green", false, "mt-3 h-11 w-full px-4")} onClick={() => loadDataset(selectedKind)}>Load Test Game</button>
          </div>

          <div className={panelClassName("p-4")}>
            <div className="mb-3 text-lg font-bold">Season Regression</div>
            <label className="block text-sm font-medium">Number of games: {seasonGames}</label>
            <input type="range" min="2" max="12" value={seasonGames} onChange={(event) => setSeasonGames(Number(event.target.value))} className="mt-3 w-full" />
            <div className="mt-2 text-sm text-zinc-500">Cycles through all fixed dataset styles to test larger sample sizes and season reporting.</div>
            <button type="button" className={buttonClassName("blue", false, "mt-3 h-11 w-full px-4")} onClick={loadSeason}>Load Test Season</button>
          </div>
        </div>

        <div className={panelClassName("p-4")}>
          <div className="mb-3 text-lg font-bold">Random Game Generator</div>
          <div className="grid gap-3 md:grid-cols-4">
            {([
              ["plays", "Plays", 20, 160], ["runPct", "Run %", 0, 100], ["blitzPct", "Blitz %", 0, 100], ["successPct", "Target Success %", 10, 90]
            ] as const).map(([key, label, min, max]) => (
              <label key={key} className="block text-sm font-medium">{label}: {randomOptions[key]}
                <input type="range" min={min} max={max} value={randomOptions[key]} onChange={(event) => setRandomOptions((current) => ({ ...current, [key]: Number(event.target.value) }))} className="mt-2 w-full" />
              </label>
            ))}
          </div>
          <button type="button" className={buttonClassName("default", false, "mt-4 h-11 w-full px-4")} onClick={loadRandom}>Generate Random Game</button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <button type="button" className={buttonClassName("green", false, "h-12 px-4")} disabled={!currentPlays.length} onClick={runVerification}>Verify Analytics</button>
          <button type="button" className={buttonClassName("default", false, "h-12 px-4")} disabled={!currentPlays.length} onClick={exportVerification}>Export Test Results</button>
          <button type="button" className={buttonClassName("blue", false, "h-12 px-4")} disabled={!currentPlays.length} onClick={onGoReports}>Review Reports</button>
          <button type="button" className={buttonClassName("danger", false, "h-12 px-4")} onClick={clearGameData}>{confirmClear ? "Confirm Clear Game Data" : "Clear Game Data"}</button>
        </div>

        {verification.length ? (
          <div className={panelClassName("p-4")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="text-lg font-bold">Analytics Verification</div><div className={`rounded-full px-3 py-1 text-sm font-semibold ${passedCount === verification.length ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{passedCount} passed · {verification.length - passedCount} failed</div></div>
            <div className="space-y-2">
              {verification.map((test) => (
                <div key={test.name} className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[160px_1fr_1fr_80px]">
                  <div className="font-semibold">{test.name}</div><div className="text-sm"><span className="text-zinc-500">Expected:</span> {test.expected}</div><div className="text-sm"><span className="text-zinc-500">Actual:</span> {test.actual}</div><div className={`text-sm font-bold ${test.passed ? "text-green-700" : "text-red-600"}`}>{test.passed ? "PASS" : "FAIL"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-500">Safety: all loaders replace only game analytics state. The {Object.values(libraries).reduce((sum, values) => sum + values.length, 0)} saved call-sheet library values remain intact.</div>
      </div>
    </div>
  );
}


// =============================================================================
// 11. ROOT APP AND SCREEN ROUTING
// Top-level screen navigation and shared library state live here.
// =============================================================================

export default function CallSheetApp() {
  const [libraries, setLibraries] = useState<Libraries>(defaultLibraries);
  const [librariesHydrated, setLibrariesHydrated] = useState(false);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("dashboard");
  const [playsForReports, setPlaysForReports] = useState<Play[]>([]);

  function handleOpenDashboard(): void {
    setActiveScreen("dashboard");
  }

  function handleOpenManager(): void {
    setActiveScreen("manager");
  }

  function handleOpenReports(): void {
    setActiveScreen("reports");
  }

  function handleOpenDeveloper(): void {
    setActiveScreen("developer");
  }

  function handlePrintReports(): void {
    setActiveScreen("reports");
    setTimeout(() => window.print(), 50);
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_CALL_SHEET_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as { libraries?: Partial<Libraries> };

        if (parsed?.libraries) {
          setLibraries(normalizeLibraries(parsed.libraries));
        } else {
          setLibraries(normalizeLibraries(defaultLibraries));
        }
      } else {
        setLibraries(normalizeLibraries(defaultLibraries));
      }
    } catch (error) {
      console.error("Unable to load call sheet libraries", error);
      setLibraries(normalizeLibraries(defaultLibraries));
    } finally {
      setLibrariesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!librariesHydrated) return;

    window.localStorage.setItem(
      LOCAL_CALL_SHEET_KEY,
      JSON.stringify({ libraries })
    );
  }, [libraries, librariesHydrated]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as { plays?: Play[] };

        if (Array.isArray(parsed?.plays)) {
          setPlaysForReports(parsed.plays);
        } else {
          setPlaysForReports([]);
        }
      } else {
        setPlaysForReports([]);
      }
    } catch (error) {
      console.error("Unable to load report plays", error);
      setPlaysForReports([]);
    }
  }, [activeScreen]);

  if (activeScreen === "manager") {
    return (
      <CallSheetManager
        libraries={libraries}
        setLibraries={setLibraries}
        onGoDashboard={handleOpenDashboard}
        onGoReports={handleOpenReports}
      />
    );
  }

  if (activeScreen === "reports") {
    return (
      <ReportsDashboard
        plays={playsForReports}
        onGoDashboard={handleOpenDashboard}
        onGoManager={handleOpenManager}
      />
    );
  }

  if (activeScreen === "developer") {
    return (
      <DeveloperTestScreen
        libraries={libraries}
        onGoDashboard={handleOpenDashboard}
        onGoReports={handleOpenReports}
        onDataChanged={() => {
          try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as { plays?: Play[] }) : {};
            setPlaysForReports(Array.isArray(parsed.plays) ? parsed.plays : []);
          } catch {
            setPlaysForReports([]);
          }
        }}
      />
    );
  }

  return (
    <MainDashboard
      libraries={libraries}
      onOpenReports={handleOpenReports}
      onOpenManager={handleOpenManager}
      onPrintReports={handlePrintReports}
      onOpenDeveloper={handleOpenDeveloper}
    />
  );
}
