"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LOCAL_CALL_SHEET_KEY = "mft-local-call-sheet-v1";
const STORAGE_KEY = "mft-game-analytics-v5";

const hashOptions = ["L", "M", "R"];

const defaultLibraries = {
  formation: [
    "CUT DBL",
    "CUT TRIPLE",
    "CUT TRIPLE LT",
    "DBL",
    "DBL LT",
    "DEUCE",
    "DEUCE LT",
    "DEUCE LT YO",
    "DEUCE YO",
    "DIRTY",
    "DIRTY LT",
    "DUNK",
    "DUNK LT",
    "TRAIL LT",
    "TRAIN",
    "TRAIN LT",
    "TREY",
    "TREY LT",
    "TRIAL",
    "TRIO",
    "TRIO LT",
    "TRIPLE",
    "TRIPLE LT",
    "TROUBLE",
    "TROUBLE LT",
    "TRUCK",
    "TRUCK LT",
  ],
  motion: ["X", "H", "Y", "Z", "XIN", "ZIP", "HAC", "YAC", "H-ORB", "WAVE"],
  protection: ["50", "51", "70", "71", "350", "351", "360", "361", "816", "817", "850", "851", "BT 16", "BT 17", "LUCY", "RICKY"],
  play: [
    "16",
    "17",
    "10 CAB",
    "11 CAB",
    "12 WRAP",
    "13 WRAP",
    "16 BROOM",
    "16 CAB",
    "16 OAK",
    "16 TOSS",
    "17 BROOM",
    "17 CAB",
    "17 OAK",
    "17 REWIND PASS",
    "17 TOSS",
    "BREAK",
    "DIME TIDE",
    "FLOOD",
    "GOOSE SLUG",
    "JAIL",
    "MESH",
    "MESH TIDE",
    "NAKED",
    "OASIS H-STICK",
    "PEEL",
    "PUMP HAWK",
    "PUNCH 16",
    "PUNCH 17",
    "QTR 12 WRAP",
    "QTR 13 WRAP",
    "RAT 14",
    "RAT 15",
  ],
  runConcept: ["DUO", "WZ", "POWER", "POWER READ", "RPO"],
  passConcept: ["QUICK", "3 LEVEL", "FULL FIELD", "FULL FIELD TAG", "SCREENS"],
  front: ["4D Over", "Okie 55", "Okie 59", "4D Under G", "4D Under", "Odd", "Even", "Bear"],
  blitz: ["None", "Barrel (B)", "PLUG", "CHOP/CALI", "CAT", "5", "6", "7", "8"],
  coverage: ["2", "3", "4"],
  result: ["Complete", "Incomplete", "Rush", "No Gain", "Touchdown", "Rush TD", "Complete, TD", "Complete TD", "Interception", "Fumble", "Fumble, Lost", "Lost", "Turnover"],
};

const defaultForm = {
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

function formatPct(value: number) {
  return `${Math.round(value)}%`;
}

function clampFieldPosition(value: number | string | undefined | null) {
  return Math.max(1, Math.min(99, Number(value) || 1));
}

function formatBallOn(position: number | string | undefined | null) {
  const pos = clampFieldPosition(position);
  if (pos === 50) return "50";
  if (pos < 50) return `-${pos}`;
  return `+${100 - pos}`;
}

function parseBallOn(displayValue: string) {
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

function getFieldZone(position: number | string | undefined | null) {
  const pos = clampFieldPosition(position);
  if (pos >= 1 && pos <= 5) return "BACKED UP";
  if (pos >= 6 && pos <= 24) return "SAFE ZONE";
  if (pos >= 25 && pos <= 75) return "OPEN FIELD";
  if (pos >= 76 && pos <= 84) return "ORANGE ZONE";
  if (pos >= 85 && pos <= 94) return "RED ZONE";
  return "GOAL LINE";
}

function getDistanceBucket(distance: number | string | undefined | null) {
  const d = Number(distance || 0);
  if (d <= 3) return "Short (1-3)";
  if (d <= 6) return "Medium (4-6)";
  return "Long (7+)";
}

function getHudlDdcat(
  down: number | string | undefined | null,
  distance: number | string | undefined | null,
  sequence: number | string | undefined | null
) {
  const d = Number(down || 0);
  const dist = Number(distance || 0);
  const seq = Number(sequence || 0);
  if (d === 1 && dist === 10 && seq === 1) return "P & 10";
  if (d === 1 || d === 2) {
    if (dist <= 4) return "Normal";
    return "Off Schedule";
  }
  const bucket = dist <= 3 ? "SH" : dist <= 6 ? "M" : "L";
  if (d === 3) return `3rd ${bucket}`;
  if (d === 4) return `4th ${bucket}`;
  return "Normal";
}
function exportFile(filename: string, content: string, type: string) {
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

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeLibraries(libraries: any) {
  const keys = Object.keys(defaultLibraries);
  const next: any = {};
  keys.forEach((key) => {
    const values = Array.isArray(libraries?.[key]) ? libraries[key] : [];
    next[key] = Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  });
  return next;
}

function seedPlay(overrides: any) {
  const base = {
    id: makeId(),
    playNumber: 1065243,
    quarter: 2,
    series: 6,
    sequence: 1,
    down: 1,
    distance: 10,
    ballOn: 25,
    hash: "M",
    playType: "Run",
    formation: "10 Trio Right H-",
    motion: "None",
    protection: "50",
    play: "16",
    runConcept: "Houston",
    passConcept: "",
    concept: "Houston",
    front: "4D Over",
    blitz: "Barrel (B)",
    coverage: "2",
    result: "Complete",
    yards: 4,
    driveId: "drive-1",
    driveResult: "TD",
  };
  const play = { ...base, ...overrides };
  return { ...play, success: getSuccess(play) };
}

const seedPlays = [
  seedPlay({ down: 1, distance: 10, ballOn: 25, hash: "L", playType: "Run", runConcept: "Houston", passConcept: "", concept: "Houston", yards: 6, sequence: 1, play: "16", result: "Rush", front: "4D Over", blitz: "None", coverage: "3" }),
  seedPlay({ down: 2, distance: 4, ballOn: 31, hash: "M", playType: "Pass", runConcept: "", passConcept: "Seattle", concept: "Seattle", coverage: "3", blitz: "None", yards: 5, sequence: 2, play: "17", result: "Complete", front: "Odd" }),
  seedPlay({ down: 1, distance: 10, ballOn: 36, hash: "R", playType: "Run", runConcept: "Orlando", passConcept: "", concept: "Orlando", front: "Okie 55", blitz: "PLUG", yards: 2, sequence: 3, play: "10 CAB", result: "Rush", coverage: "4" }),
  seedPlay({ down: 3, distance: 8, ballOn: 38, hash: "L", playType: "Pass", runConcept: "", passConcept: "Houston", concept: "Houston", coverage: "2", blitz: "6", yards: 9, sequence: 4, play: "11 CAB", result: "Complete", front: "Bear" }),
  seedPlay({ down: 1, distance: 10, ballOn: 47, hash: "M", playType: "Run", runConcept: "Read", passConcept: "", concept: "Read", front: "4D Under G", blitz: "None", yards: -1, sequence: 5, driveResult: "FG", play: "12 WRAP", result: "No Gain", coverage: "3" }),
  seedPlay({ down: 2, distance: 11, ballOn: 46, hash: "M", playType: "Pass", runConcept: "", passConcept: "Orlando", concept: "Orlando", coverage: "4", blitz: "CAT", yards: 12, sequence: 6, driveResult: "FG", play: "13 WRAP", result: "Complete", front: "Even" }),
];

function aggregateTopPlays(plays, type, dimension) {
  const grouped = new Map();

  plays
    .filter((p) => p.playType === type && p.play)
    .forEach((play) => {
      const dimensionValue = String(play[dimension] || "—");
      const key = String(play.play);
      const current = grouped.get(key) || {
        play: String(play.play),
        dimension: dimensionValue,
        attempts: 0,
        success: 0,
        yards: 0,
        dimensionCounts: {},
      };

      current.attempts += 1;
      current.success += play.success ? 1 : 0;
      current.yards += Number(play.yards || 0);
      current.dimensionCounts[dimensionValue] = (current.dimensionCounts[dimensionValue] || 0) + 1;
      grouped.set(key, current);
    });

  return Array.from(grouped.values())
    .map((item) => {
      const sortedDimensions = Object.entries(item.dimensionCounts).sort(
        (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))
      );
      const topDimension = sortedDimensions[0]?.[0] || "—";
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
        String(a.play).localeCompare(String(b.play))
    )
    .slice(0, 3);
}

function runSelfChecks() {
  const cases = [
    formatBallOn(25) === "-25",
    formatBallOn(50) === "50",
    formatBallOn(75) === "+25",
    parseBallOn("-25") === 25,
    parseBallOn("+25") === 75,
    getHudlDdcat(1, 10, 1) === "P & 10",
    getHudlDdcat(1, 10, 2) === "Off Schedule",
    getHudlDdcat(3, 2, 3) === "3rd SH",
    getHudlDdcat(4, 8, 2) === "4th L",
    getFieldZone(25) === "OPEN FIELD",
    getSuccess({ down: 1, distance: 10, yards: 5 }) === true,
    getSuccess({ down: 2, distance: 10, yards: 6 }) === false,
    getNextDownDistance({ down: 2, distance: 6, yards: 3 }, 40).down === 3,
    getNextDownDistance({ down: 1, distance: 10, yards: 10 }, 60).down === 1,
    normalizeLibraries({ formation: ["DBL", "DBL", "  TRIO  "] }).formation.length === 2,
    aggregateTopPlays(seedPlays, "Run", "front").length > 0,
    aggregateTopPlays(seedPlays, "Pass", "coverage")[0].play !== undefined,
  ];
  return cases.every(Boolean);
}

function KeyButton({ children, className, active = false, tone = "default", onClick, disabled = false }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-16 rounded-2xl border border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-200 text-2xl font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100 xl:h-14 xl:text-xl",
        active && "ring-2 ring-blue-400",
        tone === "action" && "bg-green-100 text-green-700 hover:bg-green-100",
        tone === "accent" && "bg-blue-100 text-blue-600 hover:bg-blue-100",
        tone === "danger" && "text-red-600",
        className
      )}
    >
      {children}
    </Button>
  );
}

function StatBox({ label, value, blue = false, active = false }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold tracking-wide text-zinc-100/90 xl:text-[11px]">{label}</div>
      <div
        className={cn(
          "flex h-16 items-center justify-center rounded-xl border bg-white text-4xl font-bold text-zinc-700 shadow-inner xl:h-14 xl:text-3xl",
          blue && "bg-blue-600 text-white",
          active && "ring-2 ring-amber-300"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PlaylistColumn({ label, items, selectedValue, onSelect, tall = false }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className={cn("overflow-y-auto px-2 py-2", tall ? "h-[240px]" : "h-[200px]")}>
        <div className="space-y-1">
          {items.length ? (
            items.map((item) => {
              const key = typeof item === "string" ? item : item.id;
              const value = typeof item === "string" ? item : item.value;
              const active = selectedValue === value;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "flex w-full items-start justify-start rounded-md px-2 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-50",
                    active && "bg-blue-50 text-blue-700"
                  )}
                >
                  {value}
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

function SpreadsheetColumn({ label, items, draft, onDraftChange, onSave, onDelete }) {
  return (
    <Card className="rounded-2xl border-zinc-300 shadow-sm">
      <CardContent className="p-2">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={`Paste or type ${label.toLowerCase()} values, one per line`}
          className="mb-2 h-24 w-full resize-none rounded-md border border-zinc-300 bg-white p-2 text-sm outline-none ring-0"
        />
        <Button size="sm" className="mb-2 w-full" onClick={onSave}>
          Save {label}
        </Button>
        <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
          {items.length ? (
            items.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">
                <div className="min-w-0 flex-1 truncate text-sm text-zinc-700">{item}</div>
                <Button variant="outline" size="sm" onClick={() => onDelete(item)}>
                  Delete
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-400">
              No values
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CallSheetManager({ libraries, setLibraries }) {
  const [drafts, setDrafts] = useState({
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
  const [search, setSearch] = useState("");

  function updateDraft(name, value) {
    setDrafts((prev) => ({ ...prev, [name]: value }));
  }

  function saveLibraryColumn(name) {
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

  function deleteLibraryValue(name, value) {
    setLibraries((prev) => ({
      ...prev,
      [name]: (prev[name] || []).filter((item) => item !== value),
    }));
  }

  const libraryPreview = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(libraries).map(([key, values]) => ({
      key,
      values: q ? values.filter((value) => value.toLowerCase().includes(q)) : values,
    }));
  }, [libraries, search]);

  function exportLocalCallSheet() {
    const headers = Object.keys(libraries);
    const maxRows = Math.max(0, ...headers.map((key) => libraries[key].length));
    const rowsData = Array.from({ length: maxRows }, (_, idx) => headers.map((key) => libraries[key][idx] || ""));
    exportFile(
      "local_call_sheet.csv",
      [headers.join(","), ...rowsData.map((row) => row.map((value) => JSON.stringify(value ?? "")).join(","))].join("\n"),
      "text/csv;charset=utf-8;"
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-zinc-300 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-zinc-900">Call Sheet Manager</div>
              <div className="text-sm text-zinc-500">
                Paste or type one value per line in each category column, save it, and delete values directly from the column list.
              </div>
            </div>
            <div className="flex gap-2">
              <Badge>{Object.values(libraries).reduce((sum, values) => sum + values.length, 0)} items</Badge>
              <Button variant="outline" onClick={exportLocalCallSheet}>
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card className="rounded-2xl border-zinc-300 shadow-sm">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-lg font-bold text-blue-600">Category Preview</div>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category values..." className="max-w-sm" />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            {libraryPreview.map((group) => (
              <div key={group.key} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.key}</div>
                <div className="max-h-[220px] space-y-1 overflow-y-auto">
                  {group.values.length ? (
                    group.values.map((value) => (
                      <div key={`${group.key}-${value}`} className="rounded-md bg-zinc-50 px-2 py-1 text-sm text-zinc-700">
                        {value}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-400">No values</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MainDashboard({ libraries, onOpenReports, onOpenPlaylist, onOpenSettings, onPrintReports }) {
  const [plays, setPlays] = useState(seedPlays);
  const [activeInput, setActiveInput] = useState("ballOn");
  const [form, setForm] = useState(defaultForm);
  const [hydrated, setHydrated] = useState(false);
  const [ballOnEntry, setBallOnEntry] = useState(formatBallOn(defaultForm.ballOn));
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.plays)) setPlays(parsed.plays);
        if (parsed?.form) {
          const nextForm = { ...defaultForm, ...parsed.form, ballOn: clampFieldPosition(parsed.form.ballOn ?? defaultForm.ballOn) };
          setForm(nextForm);
          setBallOnEntry(formatBallOn(nextForm.ballOn));
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ plays, form }));
  }, [plays, form, hydrated]);

  useEffect(() => {
    setBallOnEntry(formatBallOn(form.ballOn));
  }, [form.ballOn]);

  useEffect(() => {
    const nextPlayType = form.passConcept ? "Pass" : form.runConcept ? "Run" : form.playType;
    const nextConcept = form.passConcept || form.runConcept || "";
    if (form.playType !== nextPlayType || form.concept !== nextConcept) {
      setForm((prev) => ({ ...prev, playType: nextPlayType, concept: nextConcept }));
    }
  }, [form.runConcept, form.passConcept, form.playType, form.concept]);

  const summary = useMemo(() => {
    const runCount = plays.filter((p) => p.playType === "Run").length;
    const passCount = plays.filter((p) => p.playType === "Pass").length;
    const matchingConcept = plays.filter((p) => p.concept === form.concept);
    const conceptSuccess = matchingConcept.filter((p) => p.success).length;
    const blitzCount = plays.filter((p) => p.blitz && p.blitz !== "None").length;
    return {
      run: runCount,
      pass: passCount,
      efficiencyLabel: `${form.concept || "—"} ${formatPct((conceptSuccess / (matchingConcept.length || 1)) * 100)}`,
      blitzLabel: formatPct((blitzCount / (plays.length || 1)) * 100),
      fieldPositionLabel: getFieldZone(form.ballOn),
    };
  }, [plays, form.ballOn, form.concept]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function applyPlaylistSelection(type, item) {
    const value = typeof item === "string" ? item : item?.value;
    if (type === "formation") return updateField("formation", value);
    if (type === "motion") return updateField("motion", value);
    if (type === "protection") return updateField("protection", value);
    if (type === "play") return updateField("play", value);
    if (type === "runConcept") return setForm((prev) => ({ ...prev, runConcept: value, passConcept: "", playType: "Run", concept: value }));
    if (type === "passConcept") return setForm((prev) => ({ ...prev, passConcept: value, runConcept: "", playType: "Pass", concept: value }));
    if (type === "front") return updateField("front", value);
    if (type === "blitz") return updateField("blitz", value);
    if (type === "coverage") return updateField("coverage", value);
    if (type === "result") return updateField("result", value);
  }

  function appendYardsDigit(digit) {
    setForm((prev) => {
      const currentValue = Number(prev.yards || 0);
      const isNegative = currentValue < 0;
      const absolute = Math.abs(currentValue);
      const nextAbsolute = absolute === 0 ? Number(digit) : Number(`${absolute}${digit}`.slice(0, 2));
      return { ...prev, yards: isNegative ? -nextAbsolute : nextAbsolute };
    });
  }

  function toggleYardsNegative() {
    setForm((prev) => {
      const absolute = Math.abs(Number(prev.yards || 0));
      return { ...prev, yards: absolute === 0 ? 0 : -absolute };
    });
  }

  function clearYards() {
    setForm((prev) => ({ ...prev, yards: 0 }));
  }

  function appendDigit(digit) {
    if (!activeInput) return;
    if (activeInput === "ballOn") {
      const current = ballOnEntry === "50" ? "" : ballOnEntry;
      const sign = current.startsWith("+") || current.startsWith("-") ? current[0] : "-";
      const existingDigits = current.replace(/^[+-]/, "");
      const nextDigits = existingDigits === "0" || existingDigits === "" ? String(digit) : `${existingDigits}${digit}`.slice(0, 2);
      const nextEntry = `${sign}${nextDigits}`;
      setBallOnEntry(nextEntry);
      setForm((prev) => ({ ...prev, ballOn: parseBallOn(nextEntry) }));
      return;
    }
    setForm((prev) => {
      const current = String(prev[activeInput] ?? "");
      const normalizedCurrent = current === "0" ? "" : current;
      const nextRaw = `${normalizedCurrent}${digit}`;
      const nextNum = Number(nextRaw);
      return { ...prev, [activeInput]: Number.isNaN(nextNum) ? prev[activeInput] : nextNum };
    });
  }

  function applySign(sign) {
    if (!activeInput) return;
    if (activeInput === "ballOn") {
      const current = ballOnEntry === "50" ? "25" : ballOnEntry.replace(/^[+-]/, "") || "25";
      const nextEntry = `${sign === "+" ? "+" : "-"}${current}`;
      setBallOnEntry(nextEntry);
      setForm((prev) => ({ ...prev, ballOn: parseBallOn(nextEntry) }));
      return;
    }
    setForm((prev) => {
      const value = Math.abs(Number(prev[activeInput] || 0));
      return { ...prev, [activeInput]: sign === "+" ? value : -value };
    });
  }

  function clearEntry() {
    if (!activeInput) return;
    if (activeInput === "ballOn") {
      setBallOnEntry("");
      return;
    }
    setForm((prev) => ({ ...prev, [activeInput]: 0 }));
  }

  function normalizePlay(data) {
    const play = { ...data, ballOn: clampFieldPosition(data.ballOn || 25) };
    const normalizedResult = String(play.result || "").trim().toLowerCase();
    const isTdResult =
      normalizedResult === "touchdown" ||
      normalizedResult === "rush td" ||
      normalizedResult === "complete, td" ||
      normalizedResult === "complete td";

    if (isTdResult) {
      play.yards = Math.max(0, 100 - Number(play.ballOn || 25));
    }

    play.success = getSuccess(play);
    return play;
  }

  function commitPlay() {
    if (!form.hash || form.yards === "" || form.yards === null || form.yards === undefined || (!form.runConcept && !form.passConcept) || !form.result) {
      return;
    }

    const play = normalizePlay({ ...form, id: makeId() });
    const normalizedResult = String(play.result || "").trim().toLowerCase();
    const isTouchdown =
      normalizedResult === "touchdown" ||
      normalizedResult === "rush td" ||
      normalizedResult === "complete, td" ||
      normalizedResult === "complete td";
    const isTurnover =
      normalizedResult === "interception" ||
      normalizedResult === "fumble" ||
      normalizedResult === "fumble, lost" ||
      normalizedResult === "lost" ||
      normalizedResult === "turnover";

    const nextBallOn = isTouchdown || isTurnover ? 25 : clampFieldPosition(Number(play.ballOn || 25) + Number(play.yards || 0));
    const nextSeriesState = isTouchdown || isTurnover
      ? { down: 1, distance: 10, series: Number(form.series || 1) + 1, sequence: 1 }
      : { ...getNextDownDistance(play, nextBallOn), series: Number(form.series || 1), sequence: Number(form.sequence || 0) + 1 };

    setPlays((prev) => [...prev, play]);
    setForm((prev) => ({
      ...prev,
      playNumber: Number(prev.playNumber || defaultForm.playNumber) + 1,
      sequence: nextSeriesState.sequence,
      series: nextSeriesState.series,
      ballOn: nextBallOn,
      down: nextSeriesState.down,
      distance: nextSeriesState.distance,
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
  }

  function undoLastPlay() {
    setPlays((prev) => prev.slice(0, -1));
  }

  function exportHudlCsv() {
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

    const rowsData = plays.map((play, index) =>
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

    exportFile("hudl-tagging-export.csv", [headers.join(","), ...rowsData].join("\n"), "text/csv;charset=utf-8;");
  }

  function startNewGame() {
    const freshForm = {
      ...defaultForm,
      playNumber: defaultForm.playNumber,
      quarter: 1,
      series: 1,
      sequence: 1,
      down: 1,
      distance: 10,
      ballOn: 25,
      yards: 0,
    };
    setPlays([]);
    setForm(freshForm);
    setBallOnEntry(formatBallOn(freshForm.ballOn));
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function handleNewGame() {
    if (confirmNewGame) {
      startNewGame();
      setConfirmNewGame(false);
      return;
    }
    setConfirmNewGame(true);
  }

  return (
    <div className="min-h-screen bg-zinc-100 p-2 text-zinc-900 xl:h-screen xl:overflow-hidden">
      <div className="mx-auto max-w-[1850px] rounded-[28px] border bg-zinc-50 p-3 shadow-xl xl:h-[calc(100vh-16px)] xl:overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-zinc-500">Pat. D{form.playNumber}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={undoLastPlay}>
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={exportHudlCsv}>
              HUDL CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleNewGame}>
              {confirmNewGame ? "Confirm New Game" : "New Game"}
            </Button>
            {confirmNewGame ? (
              <Button variant="outline" size="sm" onClick={() => setConfirmNewGame(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 min-h-[390px] xl:h-[390px]">
          <div className="col-span-3 xl:h-full">
            <div className="grid grid-cols-4 gap-3">
              {[
                "1",
                "2",
                "3",
                "-25",
                "4",
                "5",
                "6",
                "ADD PLAY",
                "7",
                "8",
                "9",
                "",
                "",
                "−",
                "0",
                "+",
                "CLEAR",
                "",
                "",
                "",
              ].map((key, i) => {
                if (key === "") return <div key={i} />;

                if (key === "ADD PLAY") {
                  return (
                    <KeyButton
                      key={i}
                      tone="action"
                      className="col-span-1 row-span-2 h-full min-h-[140px] text-xl xl:min-h-[122px]"
                      onClick={commitPlay}
                    >
                      ADD
                      <br />
                      PLAY
                    </KeyButton>
                  );
                }

                if (key === "CLEAR") {
                  return (
                    <KeyButton key={i} className="text-xl col-span-2" onClick={clearEntry}>
                      CLEAR
                    </KeyButton>
                  );
                }

                if (key === "+" || key === "−") {
                  return (
                    <KeyButton key={i} onClick={() => applySign(key === "+" ? "+" : "-")}>
                      {key}
                    </KeyButton>
                  );
                }

                if (key === "-25") {
                  return (
                    <KeyButton
                      key={i}
                      tone="danger"
                      onClick={() => {
                        setBallOnEntry("-25");
                        updateField("ballOn", 25);
                      }}
                    >
                      {key}
                    </KeyButton>
                  );
                }

                return (
                  <KeyButton key={i} onClick={() => appendDigit(key)}>
                    {key}
                  </KeyButton>
                );
              })}
            </div>
          </div>

          <Card className="col-span-4 rounded-2xl border-zinc-500 bg-gradient-to-br from-zinc-700 via-zinc-900 to-zinc-700 text-white shadow-2xl xl:h-full">
            <CardContent className="p-4 xl:h-full">
              <div className="grid grid-cols-3 gap-4">
                <div onClick={() => setActiveInput("down")}>
                  <StatBox label="DOWN:" value={form.down} active={activeInput === "down"} />
                </div>
                <div onClick={() => setActiveInput("distance")}>
                  <StatBox label="DISTANCE:" value={form.distance} active={activeInput === "distance"} />
                </div>
                <div onClick={() => setActiveInput("ballOn")}>
                  <StatBox label="BALL ON:" value={formatBallOn(form.ballOn)} blue active={activeInput === "ballOn"} />
                </div>
                <div onClick={() => setActiveInput("quarter")}>
                  <StatBox label="QUARTER:" value={form.quarter} active={activeInput === "quarter"} />
                </div>
                <div onClick={() => setActiveInput("series")}>
                  <StatBox label="SERIES:" value={form.series} active={activeInput === "series"} />
                </div>
                <div onClick={() => setActiveInput("sequence")}>
                  <StatBox label="SEQ:" value={form.sequence} active={activeInput === "sequence"} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-xl font-medium uppercase tracking-wide text-zinc-100 xl:text-lg">DOWN & DISTANCE:</div>
                  <div className="text-xl font-medium uppercase tracking-wide text-zinc-100 xl:text-lg">FIELD POSITION:</div>
                </div>
                <div className="text-3xl font-bold uppercase leading-tight xl:text-2xl">{summary.fieldPositionLabel}</div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-6 text-xl font-bold xl:text-lg">
                <div>
                  RUN: <Badge className="ml-2 text-2xl xl:text-lg">{summary.run}</Badge>
                </div>
                <div>
                  PASS: <Badge className="ml-2 text-2xl xl:text-lg">{summary.pass}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="col-span-1 flex flex-col gap-2 xl:h-full">
            {hashOptions.map((side) => (
              <KeyButton
                key={side}
                tone="accent"
                active={form.hash === side}
                className="h-[92px] text-4xl xl:h-[82px] xl:text-3xl"
                onClick={() => updateField("hash", side)}
              >
                {side}
              </KeyButton>
            ))}
          </div>

          <div className="col-span-4 xl:h-full">
            <div className="mb-2 flex items-center justify-between px-3 text-xl font-bold xl:text-lg">
              <div>
                EFF: <span>{summary.efficiencyLabel}</span>
              </div>
              <div>
                BLITZ: <span className="text-red-600">{summary.blitzLabel}</span>
              </div>
            </div>

            <div className="grid grid-cols-[3fr_1fr] gap-2">
              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
                  <KeyButton key={key} onClick={() => appendYardsDigit(key)}>
                    {key}
                  </KeyButton>
                ))}
                <KeyButton className="col-span-3 h-16 xl:h-14" onClick={() => appendYardsDigit("0")}>
                  0
                </KeyButton>
              </div>

              <div className="grid grid-rows-[1fr_1fr_2fr] gap-3">
                <div className="rounded-xl border border-zinc-300 bg-white p-2">
                  <div className="text-sm font-semibold text-zinc-500">YARDS</div>
                  <Input value={String(form.yards)} readOnly className="mt-2 h-14 text-2xl xl:h-12 xl:text-xl" onClick={clearYards} />
                </div>
                <KeyButton className="h-full text-lg xl:text-base" onClick={toggleYardsNegative}>
                  -
                </KeyButton>
                <KeyButton
                  tone="action"
                  className="h-full text-3xl disabled:opacity-50 xl:text-2xl"
                  onClick={commitPlay}
                  disabled={!form.hash || form.yards === "" || form.yards === null || form.yards === undefined || (!form.runConcept && !form.passConcept) || !form.result}
                >
                  GO
                </KeyButton>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-9 gap-3">
          <PlaylistColumn label="Formation" items={libraries.formation} selectedValue={form.formation} onSelect={(item) => applyPlaylistSelection("formation", item)} tall />
          <PlaylistColumn label="Motion" items={libraries.motion} selectedValue={form.motion} onSelect={(item) => applyPlaylistSelection("motion", item)} tall />
          <PlaylistColumn label="Protection" items={libraries.protection} selectedValue={form.protection} onSelect={(item) => applyPlaylistSelection("protection", item)} tall />
          <PlaylistColumn label="Play" items={libraries.play} selectedValue={form.play} onSelect={(item) => applyPlaylistSelection("play", item)} tall />
          <PlaylistColumn label="Run Concept" items={libraries.runConcept} selectedValue={form.runConcept} onSelect={(item) => applyPlaylistSelection("runConcept", item)} tall />
          <PlaylistColumn label="Pass Concept" items={libraries.passConcept} selectedValue={form.passConcept} onSelect={(item) => applyPlaylistSelection("passConcept", item)} tall />
          <PlaylistColumn label="Front" items={libraries.front} selectedValue={form.front} onSelect={(item) => applyPlaylistSelection("front", item)} tall />
          <PlaylistColumn label="Blitz" items={libraries.blitz} selectedValue={form.blitz} onSelect={(item) => applyPlaylistSelection("blitz", item)} tall />
          <PlaylistColumn label="Coverage" items={libraries.coverage} selectedValue={form.coverage} onSelect={(item) => applyPlaylistSelection("coverage", item)} tall />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Result
            </div>
            <div className="h-[170px] overflow-y-auto px-2 py-2">
              <div className="space-y-1">
                {libraries.result.length ? (
                  libraries.result.map((item) => {
                    const active = item === form.result;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => applyPlaylistSelection("result", item)}
                        className={cn(
                          "flex w-full items-start justify-start rounded-md px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-50",
                          active && "bg-blue-50 text-blue-700"
                        )}
                      >
                        {item}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-1 text-sm text-zinc-400">No results</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 px-2 text-sm text-blue-600 xl:items-center xl:gap-2">
            <button type="button" className="font-medium hover:underline" onClick={onOpenSettings}>
              Settings
            </button>
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
            <button type="button" onClick={handleNewGame} className="font-medium hover:underline">
              New Game
            </button>
            <button type="button" className="font-medium hover:underline" onClick={onPrintReports}>
              Print Reports
            </button>
            <button type="button" className="font-medium hover:underline" onClick={onOpenReports}>
              Reports
            </button>
            <button type="button" className="font-medium hover:underline" onClick={onOpenPlaylist}>
              Go to Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsDashboard({ plays }) {
  const topRunByFront = useMemo(() => aggregateTopPlays(plays, "Run", "front"), [plays]);
  const topPassByFront = useMemo(() => aggregateTopPlays(plays, "Pass", "front"), [plays]);
  const topRunByBlitz = useMemo(() => aggregateTopPlays(plays, "Run", "blitz"), [plays]);
  const topPassByCoverage = useMemo(() => aggregateTopPlays(plays, "Pass", "coverage"), [plays]);

  const efficiencyRows = useMemo(() => {
    const grouped = new Map();

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

  const seriesRows = useMemo(() => {
    const grouped = new Map();

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
        ...item,
        successRate: item.plays ? (item.success / item.plays) * 100 : 0,
        latestResult: item.results[item.results.length - 1] || "",
      }));
  }, [plays]);

  function TopTable({ title, rows, dimensionLabel }) {
    return (
      <Card className="rounded-2xl border-zinc-300 shadow-sm">
        <CardContent className="p-4">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Card className="rounded-2xl border-zinc-300 shadow-sm">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-zinc-900">Reports</div>
            <div className="text-sm text-zinc-500">
              Live insights and analytics from your tracked plays, including defensive looks.
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TopTable title="Top 3 Run Plays by Success % vs Fronts" rows={topRunByFront} dimensionLabel="Front" />
          <TopTable title="Top 3 Pass Plays by Success % vs Fronts" rows={topPassByFront} dimensionLabel="Front" />
          <TopTable title="Top 3 Run Plays by Success % vs Blitz" rows={topRunByBlitz} dimensionLabel="Blitz" />
          <TopTable title="Top 3 Pass Plays by Success % vs Coverage" rows={topPassByCoverage} dimensionLabel="Coverage" />
        </div>

        <Card className="rounded-2xl border-zinc-300 shadow-sm">
          <CardContent className="p-4">
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
                        <td className="p-2">{formatPct(item.runAttempts ? (item.runSuccess / item.runAttempts) * 100 : 0)}</td>
                        <td className="p-2">{item.passAttempts}</td>
                        <td className="p-2">{formatPct(item.passAttempts ? (item.passSuccess / item.passAttempts) * 100 : 0)}</td>
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
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-300 shadow-sm">
          <CardContent className="p-4">
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
                      <tr key={item.series} className="border-b">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CallSheetApp() {
  const [libraries, setLibraries] = useState(normalizeLibraries(defaultLibraries));
  const [activeScreen, setActiveScreen] = useState("manager");
  const [playsForReports, setPlaysForReports] = useState([]);
  const selfChecksPassed = runSelfChecks();

  function handleOpenReports() {
    setActiveScreen("reports");
  }

  function handleOpenPlaylist() {
    setActiveScreen("manager");
  }

  function handleOpenSettings() {
    setActiveScreen("manager");
  }

  function handlePrintReports() {
    setActiveScreen("reports");
    setTimeout(() => window.print(), 50);
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_CALL_SHEET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLibraries(normalizeLibraries(parsed?.libraries || defaultLibraries));
      } else {
        setLibraries(normalizeLibraries(defaultLibraries));
      }
    } catch (error) {
      console.error("Unable to load local data", error);
      setLibraries(normalizeLibraries(defaultLibraries));
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.plays)) setPlaysForReports(parsed.plays);
        else setPlaysForReports([]);
      } else {
        setPlaysForReports([]);
      }
    } catch (error) {
      console.error("Unable to load report plays", error);
      setPlaysForReports([]);
    }
  }, [activeScreen]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_CALL_SHEET_KEY, JSON.stringify({ libraries }));
  }, [libraries]);

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-[1700px] space-y-4">
        {!selfChecksPassed ? (
          <Card className="rounded-2xl border-red-300 shadow-sm">
            <CardContent className="p-4 text-red-600">Validation checks failed.</CardContent>
          </Card>
        ) : null}

        <div className="flex gap-2">
          <Button variant={activeScreen === "manager" ? "default" : "outline"} onClick={() => setActiveScreen("manager")}>
            Call Sheet Manager
          </Button>
          <Button variant={activeScreen === "dashboard" ? "default" : "outline"} onClick={() => setActiveScreen("dashboard")}>
            Main Dashboard
          </Button>
          <Button variant={activeScreen === "reports" ? "default" : "outline"} onClick={() => setActiveScreen("reports")}>
            Reports
          </Button>
        </div>

        {activeScreen === "manager" ? (
          <CallSheetManager libraries={libraries} setLibraries={setLibraries} />
        ) : activeScreen === "dashboard" ? (
          <MainDashboard
            libraries={libraries}
            onOpenReports={handleOpenReports}
            onOpenPlaylist={handleOpenPlaylist}
            onOpenSettings={handleOpenSettings}
            onPrintReports={handlePrintReports}
          />
        ) : (
          <ReportsDashboard plays={playsForReports} />
        )}
      </div>
    </div>
  );
}
