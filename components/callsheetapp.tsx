"use client";

import React, { useEffect, useMemo, useState } from "react";

const LOCAL_CALL_SHEET_KEY = "mft-local-call-sheet-v1";
const STORAGE_KEY = "mft-game-analytics-v6";

type HashOption = "L" | "M" | "R";
type PlayType = "Run" | "Pass";
type ActiveScreen = "dashboard" | "manager" | "reports";
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
  | "result";

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

const hashOptions: HashOption[] = ["L", "M", "R"];

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
  result: [],
};

const defaultForm: PlayForm = {
  playNumber: 1065243,
  quarter: 1,
  series: 1,
  sequence: 1,
  down: 1,
  distance: 10,
  ballOn: 25,
  hash: "L",
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

function getFieldZone(position: number | string | undefined | null): string {
  const pos = clampFieldPosition(position);
  if (pos >= 1 && pos <= 5) return "BACKED UP";
  if (pos >= 6 && pos <= 24) return "SAFE ZONE";
  if (pos >= 25 && pos <= 75) return "OPEN FIELD";
  if (pos >= 76 && pos <= 84) return "ORANGE ZONE";
  if (pos >= 85 && pos <= 94) return "RED ZONE";
  return "GOAL LINE";
}

function getDistanceBucket(distance: number | string | undefined | null): string {
  const d = Number(distance || 0);
  if (d <= 3) return "Short (1-3)";
  if (d <= 6) return "Medium (4-6)";
  return "Long (7+)";
}

function getHudlDdcat(
  down: number | string | undefined | null,
  distance: number | string | undefined | null,
  sequence: number | string | undefined | null
): string {
  const d = Number(down || 0);
  const dist = Number(distance || 0);
  const seq = Number(sequence || 0);

  if (d === 1 && dist === 10 && seq === 1) return "P & 10";
  if (d === 1) return "1 DN";

  if (d === 2) {
    if (dist <= 4) return "Normal";
    return "Off Schedule";
  }

  const bucket = dist <= 3 ? "SH" : dist <= 6 ? "M" : "L";

  if (d === 3) return `3rd ${bucket}`;
  if (d === 4) return `4th ${bucket}`;

  return "Normal";
}

function getSuccess(play: Pick<PlayForm, "down" | "distance" | "yards">): boolean {
  const down = Number(play.down || 0);
  const distance = Number(play.distance || 0);
  const yards = Number(play.yards || 0);

  if (down === 1) return yards >= Math.ceil(distance * 0.5);
  if (down === 2) return yards >= Math.ceil(distance * 0.7);
  return yards >= distance;
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
    "result",
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

function aggregateTopPlays(plays: Play[], type: PlayType, dimension: keyof Play): TopPlayRow[] {
  const grouped = new Map<
    string,
    {
      play: string;
      attempts: number;
      success: number;
      yards: number;
      dimensions: Record<string, number>;
    }
  >();

  plays
    .filter((play) => play.playType === type && play.play)
    .forEach((play) => {
      const key = play.play;
      const dimensionValue = String(play[dimension] || "—");
      const current = grouped.get(key) || {
        play: key,
        attempts: 0,
        success: 0,
        yards: 0,
        dimensions: {},
      };

      current.attempts += 1;
      current.success += play.success ? 1 : 0;
      current.yards += Number(play.yards || 0);
      current.dimensions[dimensionValue] = (current.dimensions[dimensionValue] || 0) + 1;
      grouped.set(key, current);
    });

  return Array.from(grouped.values())
    .map((item) => {
      const topDimension =
        Object.entries(item.dimensions).sort(
          (a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0])
        )[0]?.[0] || "—";

      return {
        play: item.play,
        dimension: topDimension,
        attempts: item.attempts,
        success: item.success,
        yards: item.yards,
        successRate: item.attempts ? (item.success / item.attempts) * 100 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.successRate - a.successRate ||
        b.attempts - a.attempts ||
        b.yards - a.yards ||
        a.play.localeCompare(b.play)
    )
    .slice(0, 3);
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
    blitz: "None",
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

function MainDashboard({
  libraries,
  onOpenReports,
  onOpenManager,
  onPrintReports,
}: {
  libraries: Libraries;
  onOpenReports: () => void;
  onOpenManager: () => void;
  onPrintReports: () => void;
}) {
  const [plays, setPlays] = useState<Play[]>(seedPlays);
  const [form, setForm] = useState<PlayForm>(defaultForm);
  const [activeInput, setActiveInput] = useState<ActiveInput>("ballOn");
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

  useEffect(() => {
  const preventTouchMove = (e: TouchEvent) => {
    e.preventDefault();
  };

  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  document.addEventListener("touchmove", preventTouchMove, { passive: false });

  return () => {
    document.removeEventListener("touchmove", preventTouchMove);
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  };
}, []);

  const summary = useMemo(() => {
    const runCount = plays.filter((p) => p.playType === "Run").length;
    const passCount = plays.filter((p) => p.playType === "Pass").length;
    const matchingConcept = plays.filter((p) => p.concept === form.concept && form.concept);
    const conceptSuccess = matchingConcept.filter((p) => p.success).length;
    const blitzCount = plays.filter((p) => p.blitz && p.blitz !== "None").length;

    return {
      run: runCount,
      pass: passCount,
      efficiencyLabel: `${form.concept || "—"} ${formatPct(
        (conceptSuccess / (matchingConcept.length || 1)) * 100
      )}`,
      blitzLabel: formatPct((blitzCount / (plays.length || 1)) * 100),
      fieldPositionLabel: getFieldZone(form.ballOn),
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

    if (type === "result") {
      return { ...prev, result: prev.result === value ? "" : value };
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

  setForm((prev) => {
    const current = String(prev[activeInput] ?? "");
    const normalized = current === "0" ? "" : current;
    const nextNum = Number(`${normalized}${digit}`);
    if (Number.isNaN(nextNum)) return prev;
    return { ...prev, [activeInput]: nextNum };
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
      normalizedResult === "fumble, lost" ||
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
    <div className="h-[100dvh] overflow-hidden overscroll-none bg-zinc-100 p-2 text-zinc-900">
    <div className="h-[100dvh] overflow-hidden bg-zinc-100 p-2 text-zinc-900">
      <div className="mx-auto flex h-[calc(100dvh-16px)] max-w-[1366px] flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50 p-3 shadow-xl">
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
                <div onClick={() => setActiveInput("distance")}>
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
            </div>
          </div>

          <div className="col-span-1 flex h-full flex-col gap-2">
            {hashOptions.map((side) => (
              <KeyButton
                key={side}
                kind="blue"
                active={form.hash === side}
                className="h-[100px] text-3xl"
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
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl font-semibold text-zinc-700"
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
                  className="h-full text-2xl"
                  onClick={commitPlay}
                  disabled={
                    !form.hash ||
                    !form.result ||
                    (!form.runConcept && !form.passConcept) ||
                    !Number.isFinite(form.down) ||
                    !Number.isFinite(form.distance) ||
                    !Number.isFinite(form.ballOn)
                  }
                >
                  GO
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

          <div className={panelClassName()}>
            <div className="border-b border-zinc-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Result
            </div>
            <div className="h-[100px] overflow-y-auto px-2 py-2">
              <div className="grid grid-cols-2 gap-1">
                {libraries.result.map((item) => {
                  const active = item === form.result;
                  return (
                    <button
                      key={`result-${item}`}
                      type="button"
                      onClick={() => applyPlaylistSelection("result", item)}
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
          <PlaylistColumn
            label="Run Concept"
            items={libraries.runConcept}
            selectedValue={form.runConcept}
            onSelect={(value) => applyPlaylistSelection("runConcept", value)}
          />
          <PlaylistColumn
            label="Pass Concept"
            items={libraries.passConcept}
            selectedValue={form.passConcept}
            onSelect={(value) => applyPlaylistSelection("passConcept", value)}
          />
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
        </div>
      </div>
    </div>
  );
}

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
    result: "",
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
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
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
          <SpreadsheetColumn label="Result" items={libraries.result} draft={drafts.result} onDraftChange={(value) => updateDraft("result", value)} onSave={() => saveLibraryColumn("result")} onDelete={(value) => deleteLibraryValue("result", value)} />
        </div>

        <BottomNav onGoDashboard={onGoDashboard} onGoManager={() => {}} onGoReports={onGoReports} />
      </div>
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
  return (
    <div className={panelClassName()}>
      <div className="p-4">
        <div className="mb-3 text-lg font-bold text-blue-600">{title}</div>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-zinc-500">
                <th className="p-2">Play</th>
                <th className="p-2">{dimensionLabel}</th>
                <th className="p-2">Att</th>
                <th className="p-2">Success %</th>
                <th className="p-2">Yards</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((item, idx) => (
                  <tr key={`${item.play}-${item.dimension}-${idx}`} className="border-b">
                    <td className="p-2">{item.play}</td>
                    <td className="p-2">{item.dimension}</td>
                    <td className="p-2">{item.attempts}</td>
                    <td className="p-2">{formatPct(item.successRate)}</td>
                    <td className="p-2">{item.yards}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-zinc-400" colSpan={5}>
                    No data yet.
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
  const topRunByFront = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Run", "front"), [plays]);
  const topPassByFront = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Pass", "front"), [plays]);
  const topRunByBlitz = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Run", "blitz"), [plays]);
  const topPassByCoverage = useMemo<TopPlayRow[]>(() => aggregateTopPlays(plays, "Pass", "coverage"), [plays]);

  const efficiencyRows = useMemo<EfficiencyRow[]>(() => {
    const grouped = new Map<string, EfficiencyRow>();

    plays.forEach((play) => {
      const key = `${play.down}|${getDistanceBucket(play.distance)}|${play.front || "—"}|${play.blitz || "—"}|${play.coverage || "—"}`;
      const current = grouped.get(key) || {
        down: play.down,
        bucket: getDistanceBucket(play.distance),
        front: play.front || "—",
        blitz: play.blitz || "—",
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

    return Array.from(grouped.values()).sort(
      (a, b) => Number(a.down) - Number(b.down) || String(a.bucket).localeCompare(String(b.bucket))
    );
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

    return Array.from(grouped.values())
      .sort((a, b) => a.series - b.series)
      .map((item) => ({
        series: item.series,
        plays: item.plays,
        yards: item.yards,
        success: item.success,
        successRate: item.plays ? (item.success / item.plays) * 100 : 0,
        latestResult: item.results[item.results.length - 1] || "",
      }));
  }, [plays]);

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className={panelClassName()}>
          <div className="p-4">
            <div className="text-2xl font-bold text-zinc-900">Reports</div>
            <div className="text-sm text-zinc-500">
              Live insights and analytics from your tracked plays, including defensive looks.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TopTable title="Top 3 Run Plays by Success % vs Fronts" rows={topRunByFront} dimensionLabel="Front" />
          <TopTable title="Top 3 Pass Plays by Success % vs Fronts" rows={topPassByFront} dimensionLabel="Front" />
          <TopTable title="Top 3 Run Plays by Success % vs Blitz" rows={topRunByBlitz} dimensionLabel="Blitz" />
          <TopTable title="Top 3 Pass Plays by Success % vs Coverage" rows={topPassByCoverage} dimensionLabel="Coverage" />
        </div>

        <div className={panelClassName()}>
          <div className="p-4">
            <div className="mb-3 text-lg font-bold text-blue-600">
              Run vs Pass Efficiency by Down, Distance, Front, Blitz, Coverage
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-zinc-500">
                    <th className="p-2">Down</th>
                    <th className="p-2">Distance</th>
                    <th className="p-2">Front</th>
                    <th className="p-2">Blitz</th>
                    <th className="p-2">Coverage</th>
                    <th className="p-2">Run Att</th>
                    <th className="p-2">Run Success %</th>
                    <th className="p-2">Pass Att</th>
                    <th className="p-2">Pass Success %</th>
                  </tr>
                </thead>
                <tbody>
                  {efficiencyRows.length ? (
                    efficiencyRows.map((item, idx) => (
                      <tr
                        key={`${item.down}-${item.bucket}-${item.front}-${item.blitz}-${item.coverage}-${idx}`}
                        className="border-b"
                      >
                        <td className="p-2">{item.down}</td>
                        <td className="p-2">{item.bucket}</td>
                        <td className="p-2">{item.front}</td>
                        <td className="p-2">{item.blitz}</td>
                        <td className="p-2">{item.coverage}</td>
                        <td className="p-2">{item.runAttempts}</td>
                        <td className="p-2">
                          {formatPct(item.runAttempts ? (item.runSuccess / item.runAttempts) * 100 : 0)}
                        </td>
                        <td className="p-2">{item.passAttempts}</td>
                        <td className="p-2">
                          {formatPct(item.passAttempts ? (item.passSuccess / item.passAttempts) * 100 : 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-3 text-zinc-400" colSpan={9}>
                        No efficiency data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={panelClassName()}>
          <div className="p-4">
            <div className="mb-3 text-lg font-bold text-blue-600">Drive Series Analytics</div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-zinc-500">
                    <th className="p-2">Series</th>
                    <th className="p-2">Plays</th>
                    <th className="p-2">Yards</th>
                    <th className="p-2">Success %</th>
                    <th className="p-2">Latest Result</th>
                  </tr>
                </thead>
                <tbody>
                  {seriesRows.length ? (
                    seriesRows.map((item) => (
                      <tr key={`series-${item.series}`} className="border-b">
                        <td className="p-2">{item.series}</td>
                        <td className="p-2">{item.plays}</td>
                        <td className="p-2">{item.yards}</td>
                        <td className="p-2">{formatPct(item.successRate)}</td>
                        <td className="p-2">{item.latestResult}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-3 text-zinc-400" colSpan={5}>
                        No series data yet.
                      </td>
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

  return (
    <MainDashboard
      libraries={libraries}
      onOpenReports={handleOpenReports}
      onOpenManager={handleOpenManager}
      onPrintReports={handlePrintReports}
    />
  );
}
