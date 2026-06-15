import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Share2, Delete } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { u as useGameStore, g as getUserStatsServerFn, D as Dialog, c as submitGuessServerFn, d as Route } from "./router-CDQTwt2f.js";
import { B as Button } from "./Label-wLCwUdwb.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { E as EMPTY_STATS, b as applyTerminalToStats, W as WORD_LENGTH, M as MAX_GUESSES, T as TILE_POP_PEAK_DURATION_MS, c as TILE_POP_PEAK_SCALE, d as TILE_POP_SPRING_BOUNCE, e as MIN_GUESS_LENGTH } from "./router-Cvm9yxbF.js";
import clsx from "clsx";
import { animate, createScope, spring } from "animejs";
import "@tanstack/react-router";
import "@headlessui/react";
import "./email-CMSc4YY_.js";
import "../server.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "@tanstack/react-router/ssr/server";
import "@aws-sdk/client-ses";
import "node:crypto";
import "./prisma-CDBmz4-v.js";
import "node:path";
import "node:url";
import "@prisma/client/runtime/client";
import "@prisma/adapter-pg";
import "valibot";
import "./auth-middleware-D9HYqFnh.js";
import "./auth-CoiYOFBV.js";
import "unique-username-generator";
import "ioredis";
import "@trpc/server/adapters/fetch";
import "./init-CNGCFNT_.js";
import "@trpc/server";
import "superjson";
const useStatsStore = create()(
  persist(
    (set) => ({
      stats: EMPTY_STATS,
      applyTerminal: (outcome, guessCount, puzzleNumber) => set((state) => ({
        stats: applyTerminalToStats(
          state.stats,
          outcome,
          guessCount,
          puzzleNumber
        )
      })),
      reset: () => set({ stats: EMPTY_STATS })
    }),
    {
      name: "grammble-stats",
      partialize: (state) => ({ stats: state.stats })
    }
  )
);
const OPEN_DELAY_MS = 1e3;
const useEndGameDialogStore = create((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  isAppHydrated: false,
  setIsAppHydrated: (hydrated) => set({ isAppHydrated: hydrated })
}));
function useEndGameDialog() {
  const status = useGameStore((s) => s.status);
  const isOpen = useEndGameDialogStore((s) => s.isOpen);
  const setIsOpen = useEndGameDialogStore((s) => s.setIsOpen);
  const isAppHydrated = useEndGameDialogStore((s) => s.isAppHydrated);
  const hasShownRef = useRef(false);
  const wasAlreadyOverAtHydrationRef = useRef(null);
  useEffect(() => {
    if (!isAppHydrated) return;
    if (status === "IN_PROGRESS") return;
    if (hasShownRef.current) return;
    if (wasAlreadyOverAtHydrationRef.current === null) {
      wasAlreadyOverAtHydrationRef.current = true;
    }
    const delay = wasAlreadyOverAtHydrationRef.current ? 0 : OPEN_DELAY_MS;
    const timeoutId = window.setTimeout(() => {
      hasShownRef.current = true;
      setIsOpen(true);
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [status, setIsOpen, isAppHydrated]);
  useEffect(() => {
    if (!isAppHydrated) return;
    if (wasAlreadyOverAtHydrationRef.current !== null) return;
    wasAlreadyOverAtHydrationRef.current = status !== "IN_PROGRESS";
  }, [isAppHydrated, status]);
  return { isOpen, setIsOpen };
}
const DIFFICULTY_CIRCLE = {
  easy: "🟢",
  med: "🟡",
  hard: "🔴"
};
const EMOJI = {
  correct: "🟩",
  gramCorrect: "🟩",
  misplaced: "🟨",
  gramMisplaced: "🟧",
  absent: "⬛"
};
const OUT_OF_BOUNDS = "⬜";
function buildShareGrid(feedback) {
  return feedback.map((row) => {
    const cells = row.map((f) => EMOJI[f]);
    while (cells.length < WORD_LENGTH) cells.push(OUT_OF_BOUNDS);
    return cells.join("");
  }).join("\n");
}
function buildShareText({
  puzzleNumber,
  gram,
  guessCount,
  maxGuesses,
  won,
  feedback,
  difficulty
}) {
  const score = won ? `${guessCount}/${maxGuesses}` : `X/${maxGuesses}`;
  const circle = DIFFICULTY_CIRCLE[difficulty];
  const header = `Grammble #${puzzleNumber} ${circle} ${gram.toUpperCase()} ${score}`;
  const grid = buildShareGrid(feedback);
  return [header, grid].join("\n");
}
function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1e3));
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor(total % 3600 / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
const PUZZLE_TIMEZONE = "America/Los_Angeles";
const tzPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PUZZLE_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
function msUntilNextPuzzleReset() {
  const now = /* @__PURE__ */ new Date();
  const parts = tzPartsFormatter.formatToParts(now).reduce(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {}
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const elapsed = hour * 3600 + minute * 60 + second;
  const remainingSec = 24 * 3600 - elapsed;
  return remainingSec * 1e3 - now.getMilliseconds();
}
function useCountdown() {
  const [remaining, setRemaining] = useState(msUntilNextPuzzleReset);
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(msUntilNextPuzzleReset());
    }, 1e3);
    return () => window.clearInterval(id);
  }, []);
  return formatCountdown(remaining);
}
function EndGameDialog({
  puzzleNumber,
  difficulty,
  isAuthed,
  initialStats
}) {
  const { isOpen, setIsOpen } = useEndGameDialog();
  const status = useGameStore((s) => s.status);
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);
  const gram = useGameStore((s) => s.gram);
  const revealedWord = useGameStore((s) => s.revealedWord);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const setToast = useGameStore((s) => s.setToast);
  const { data: serverStats } = useQuery({
    queryKey: ["userStats"],
    queryFn: () => getUserStatsServerFn(),
    enabled: isAuthed,
    initialData: isAuthed ? initialStats : void 0,
    staleTime: Infinity
  });
  const localStats = useStatsStore((s) => s.stats);
  const stats = isAuthed ? serverStats ?? EMPTY_STATS : localStats;
  const countdown = useCountdown();
  const [copied, setCopied] = useState(false);
  const won = status === "WON";
  const guessCount = won ? guesses.filter((g) => g.length > 0).length : MAX_GUESSES;
  const shareText = useMemo(
    () => buildShareText({
      puzzleNumber,
      gram,
      guessCount,
      maxGuesses: MAX_GUESSES,
      won,
      feedback,
      difficulty
    }),
    [puzzleNumber, gram, guessCount, won, feedback, difficulty]
  );
  const winPct = stats.played > 0 ? Math.round(stats.wins / stats.played * 100) : 0;
  const maxBar = Math.max(1, ...stats.distribution);
  const highlightRow = won ? guessCount : -1;
  const handleShare = async () => {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    try {
      if (nav?.share) {
        await nav.share({ text: shareText });
        return;
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(shareText);
        setCopied(true);
        setToast({ message: "Results copied to clipboard", type: "success" });
        window.setTimeout(() => setCopied(false), 2e3);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed", err);
        setToast({ message: "Could not share results", type: "error" });
      }
    }
  };
  if (status === "IN_PROGRESS") return null;
  return /* @__PURE__ */ jsx(
    Dialog,
    {
      isOpen,
      setIsOpen,
      onOpen: pauseGame,
      onClose: resumeGame,
      children: /* @__PURE__ */ jsxs("div", { className: "p-6 flex flex-col gap-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-3xl font-bold", children: won ? "Congratulations!" : "Better luck tomorrow" }),
          !won && revealedWord && /* @__PURE__ */ jsxs("p", { className: "text-accent mt-1", children: [
            "The word was",
            " ",
            /* @__PURE__ */ jsx("span", { className: "font-bold text-zinc-900 dark:text-zinc-100 uppercase", children: revealedWord })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-4 gap-2", children: [
          /* @__PURE__ */ jsx(StatTile, { label: "Played", value: stats.played }),
          /* @__PURE__ */ jsx(StatTile, { label: "Win %", value: winPct }),
          /* @__PURE__ */ jsx(StatTile, { label: "Streak", value: stats.currentStreak }),
          /* @__PURE__ */ jsx(StatTile, { label: "Max Streak", value: stats.maxStreak })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm text-accent tracking-wide mb-2", children: "Guess Distribution" }),
          /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-1", children: stats.distribution.map((count, i) => {
            const pct = count / maxBar * 100;
            const isHighlight = i + 1 === highlightRow;
            return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "w-4 font-mono", children: i + 1 }),
              /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsx(
                "div",
                {
                  className: `h-6 rounded-sm flex items-center justify-end px-2 text-xs font-bold text-white ${isHighlight ? "bg-green-600" : "bg-zinc-700"}`,
                  style: { width: `${Math.max(8, pct)}%` },
                  children: count
                }
              ) })
            ] }, i);
          }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs uppercase tracking-wide text-accent", children: "Next puzzle" }),
            /* @__PURE__ */ jsx("p", { className: "font-mono text-lg font-bold", children: countdown })
          ] }),
          /* @__PURE__ */ jsxs(
            Button,
            {
              onClick: handleShare,
              "aria-label": "Share results",
              className: "w-full justify-center",
              children: [
                /* @__PURE__ */ jsx(Share2, { className: "w-4 h-4 mr-2", "aria-hidden": "true" }),
                copied ? "Copied!" : "Share"
              ]
            }
          )
        ] })
      ] })
    }
  );
}
function StatTile({
  label,
  value
}) {
  return /* @__PURE__ */ jsxs("div", { className: "bg-accent py-2 px-1 rounded-lg flex flex-col items-center justify-between text-center gap-2", children: [
    /* @__PURE__ */ jsx("h3", { className: "h-full flex items-end text-xs text-accent", children: label }),
    /* @__PURE__ */ jsx("p", { className: "text-3xl font-bold", children: value })
  ] });
}
const MAX_TILE_SIZE = 56;
const TILE_GAP = 2;
const ROW_PADDING = 4;
const difficultyStyles = {
  easy: "text-green-600 dark:text-green-400",
  med: "text-yellow-600 dark:text-yellow-400",
  hard: "text-red-600 dark:text-red-400"
};
function formatDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
function Scoreboard({
  gram,
  date,
  puzzleNumber,
  difficulty
}) {
  const letters = gram.split("");
  const scaleStyle = {
    "--sb-px": "calc(10px + (var(--tile-size, 52px) - 36px) * 0.3)",
    "--sb-py": "calc(6px + (var(--tile-size, 52px) - 36px) * 0.2)",
    "--sb-title-font": "calc(13px + (var(--tile-size, 52px) - 36px) * 0.2)",
    "--sb-meta-font": "calc(10px + (var(--tile-size, 52px) - 36px) * 0.12)",
    "--sb-gram-font": "calc(14px + (var(--tile-size, 52px) - 36px) * 0.25)",
    "--sb-gram-size": "calc(22px + (var(--tile-size, 52px) - 36px) * 0.5)"
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "select-none flex w-full items-center justify-between overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 whitespace-nowrap mb-2 p-2",
      style: { ...scaleStyle },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: "font-bold text-zinc-900 dark:text-zinc-100",
              style: { fontSize: "var(--sb-title-font)" },
              children: formatDate(date)
            }
          ),
          /* @__PURE__ */ jsxs(
            "span",
            {
              className: "text-zinc-500 dark:text-zinc-400",
              style: { fontSize: "var(--sb-meta-font)" },
              children: [
                "Puzzle No.",
                " ",
                /* @__PURE__ */ jsx("span", { className: `font-semibold ${difficultyStyles[difficulty]}`, children: puzzleNumber })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "grid place-items-center bg-linear-to-b from-zinc-50 to-white text-zinc-900 shadow-[inset_0_-2px_2px_var(--color-zinc-200)] border border-zinc-300 border-t border-t-zinc-200 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-100 dark:shadow-[inset_0_-2px_2px_var(--color-zinc-950)]",
            style: {
              fontSize: "var(--sb-gram-font)",
              marginTop: "calc(var(--sb-py) * -1)",
              marginBottom: "calc(var(--sb-py) * -1)",
              height: "calc(var(--sb-gram-size) + var(--sb-py) * 2)",
              gridTemplateColumns: "calc(var(--sb-gram-size) + var(--sb-py) * 2) calc(var(--sb-gram-size) + var(--sb-py) * 2)",
              gap: "var(--tile-gap, 2px)",
              borderRadius: "calc((var(--sb-gram-size) + var(--sb-py) * 2) * 0.308) / calc((var(--sb-gram-size) + var(--sb-py) * 2) * 0.231)"
            },
            children: letters.map((l) => /* @__PURE__ */ jsx("span", { className: "grid place-items-center font-bold", children: l }, l))
          }
        )
      ]
    }
  );
}
const FEEDBACK_CLASSES = {
  correct: "tile-correct",
  gramCorrect: "tile-correct",
  misplaced: "tile-misplaced",
  gramMisplaced: "tile-misplaced",
  absent: "tile-absent"
};
function useAnimeMount(animateIn, animateOut) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(true);
  const dismissedRef = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, animateIn);
  }, []);
  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (!ref.current) {
      setMounted(false);
      return;
    }
    animate(ref.current, {
      ...animateOut,
      onComplete: () => setMounted(false)
    });
  }, [animateOut]);
  return { ref, mounted, dismiss };
}
function AntsOutline() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "ants-svg",
      viewBox: "0 0 100 100",
      preserveAspectRatio: "none",
      children: /* @__PURE__ */ jsx(
        "rect",
        {
          x: "2",
          y: "2",
          width: "96",
          height: "96",
          rx: "30.8",
          ry: "23.1",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "3",
          strokeDasharray: "32 12"
        }
      )
    }
  );
}
const CHAR_IN = {
  translateY: [
    { from: -3, to: 1, duration: 100 },
    { to: 0, duration: 50 }
  ],
  scale: [
    { from: 0.98, to: 1.02, duration: 100 },
    { to: 1, duration: 50 }
  ],
  ease: "cubicBezier(0.2, 0.8, 0.3, 1.1)"
};
const CHAR_OUT = {
  translateY: 4,
  opacity: 0,
  duration: 100,
  ease: "cubicBezier(0.2, 0.8, 0.3, 1.1)"
};
function TileChar({
  char,
  feedback,
  isEditing,
  dismissing,
  onExited
}) {
  const { ref, mounted, dismiss } = useAnimeMount(
    CHAR_IN,
    CHAR_OUT
  );
  useEffect(() => {
    if (dismissing) dismiss();
  }, [dismissing, dismiss]);
  useEffect(() => {
    if (!mounted) onExited();
  }, [mounted, onExited]);
  if (!mounted) return null;
  return /* @__PURE__ */ jsx(
    "span",
    {
      ref,
      className: clsx(
        "tile-char",
        feedback && FEEDBACK_CLASSES[feedback]
      ),
      children: char
    }
  );
}
function GuessTile({
  char,
  feedback,
  hidden,
  index,
  editable,
  active
}) {
  const editing = useGameStore((s) => s.editing);
  const editKey = useGameStore((s) => s.editKey);
  const hasChar = char !== "";
  const isEditing = !!editable && editing.toggled && index !== void 0 && editing.key === index;
  const [renderChar, setRenderChar] = useState(hasChar);
  const charSnapshotRef = useRef(char);
  const charKeyRef = useRef(0);
  if (hasChar) charSnapshotRef.current = char;
  useEffect(() => {
    if (hasChar && !renderChar) {
      charKeyRef.current += 1;
      setRenderChar(true);
    }
  }, [hasChar, renderChar]);
  const handlePointerDown = (e) => {
    if (!editable || index === void 0) return;
    e.stopPropagation();
    editKey(index, !isEditing);
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-editable-tile": editable ? "" : void 0,
      onPointerDown: editable ? handlePointerDown : void 0,
      className: clsx(
        "tile",
        !hasChar && "tile-blank",
        hidden && "invisible",
        editable && "cursor-pointer",
        active && "border-zinc-400 dark:border-zinc-100"
      ),
      children: [
        renderChar && /* @__PURE__ */ jsx(
          TileChar,
          {
            char: charSnapshotRef.current,
            feedback,
            isEditing,
            dismissing: !hasChar,
            onExited: () => setRenderChar(false)
          },
          charKeyRef.current
        ),
        isEditing && /* @__PURE__ */ jsx(AntsOutline, {})
      ]
    }
  );
}
function GramChar({ chars, feedback }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, {
      opacity: [{ from: 0, to: 1 }],
      duration: 240,
      ease: "out(2)"
    });
  }, []);
  return /* @__PURE__ */ jsxs(
    "span",
    {
      ref,
      className: clsx("tile-char-wide", feedback && FEEDBACK_CLASSES[feedback]),
      children: [
        /* @__PURE__ */ jsx("span", { className: "mr-[4px]", children: chars[0] }),
        /* @__PURE__ */ jsx("span", { className: "mr-[4px]", children: chars[1] })
      ]
    }
  );
}
function GramTile({
  chars,
  feedback,
  columnStart,
  show,
  leftIndex,
  rightIndex,
  editable
}) {
  const editing = useGameStore((s) => s.editing);
  const editKey = useGameStore((s) => s.editKey);
  const canEdit = editable && show;
  const leftActive = canEdit && editing.toggled && editing.key === leftIndex;
  const rightActive = canEdit && editing.toggled && editing.key === rightIndex;
  const handleHalfPointerDown = (index) => (e) => {
    if (!canEdit) return;
    e.stopPropagation();
    editKey(index, true);
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: clsx("tile-wide", !show && "pointer-events-none"),
      style: {
        transform: `translateX(calc(${columnStart - 1} * (var(--tile-size, 52px) + var(--tile-gap, 2px)) + var(--tile-gap, 2px) * 2))`,
        transition: "none"
      },
      "aria-hidden": !show,
      children: [
        show && /* @__PURE__ */ jsx(GramChar, { chars, feedback }),
        canEdit && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              "data-editable-tile": "",
              onPointerDown: handleHalfPointerDown(leftIndex),
              style: { width: "var(--tile-size, 52px)" },
              className: "absolute inset-y-0 left-0 cursor-pointer rounded-[inherit]",
              children: leftActive && /* @__PURE__ */ jsx(AntsOutline, {})
            }
          ),
          /* @__PURE__ */ jsx(
            "span",
            {
              "data-editable-tile": "",
              onPointerDown: handleHalfPointerDown(rightIndex),
              style: { width: "var(--tile-size, 52px)" },
              className: "absolute inset-y-0 right-0 cursor-pointer rounded-[inherit]",
              children: rightActive && /* @__PURE__ */ jsx(AntsOutline, {})
            }
          )
        ] })
      ]
    }
  );
}
function useGramPosition({
  guess,
  gram,
  feedback,
  isCurrentRow
}) {
  const editingToggled = useGameStore((s) => s.editing.toggled);
  const feedbackGramStart = feedback?.findIndex(
    (f) => f === "gramCorrect" || f === "gramMisplaced"
  ) ?? -1;
  const liveGramStart = feedbackGramStart !== -1 ? feedbackGramStart : gram.length > 0 ? guess.indexOf(gram) : -1;
  const liveHasGram = liveGramStart !== -1;
  const freezeActive = isCurrentRow && editingToggled;
  const frozenRef = useRef(
    null
  );
  if (freezeActive && !frozenRef.current) {
    frozenRef.current = { gramStart: liveGramStart, hasGram: liveHasGram };
  } else if (!freezeActive && frozenRef.current) {
    frozenRef.current = null;
  }
  const gramStart = frozenRef.current ? frozenRef.current.gramStart : liveGramStart;
  const hasGram = frozenRef.current ? frozenRef.current.hasGram : liveHasGram;
  const [stableGramStart, setStableGramStart] = useState(gramStart);
  useEffect(() => {
    if (gramStart !== -1) setStableGramStart(gramStart);
  }, [gramStart]);
  const activeStart = hasGram ? gramStart : stableGramStart;
  const parkColumn = stableGramStart !== -1 ? stableGramStart + 1 : Math.max(1, guess.length);
  const gridColumnStart = hasGram ? gramStart + 1 : parkColumn;
  const charsForTile = activeStart !== -1 ? [guess[activeStart] ?? "", guess[activeStart + 1] ?? ""] : ["", ""];
  const feedbackForTile = activeStart !== -1 ? feedback?.[activeStart] : void 0;
  return {
    gramStart,
    hasGram,
    gridColumnStart,
    charsForTile,
    feedbackForTile
  };
}
function GuessRow({
  guess,
  feedback,
  gram,
  cols = WORD_LENGTH,
  isCurrentRow,
  isFirstRow,
  isLastRow
}) {
  const setGuess = useGameStore((s) => s.setGuess);
  const status = useGameStore((s) => s.status);
  const editingToggled = useGameStore((s) => s.editing.toggled);
  const isSubmitted = !isCurrentRow && guess.length > 0 && !!feedback;
  const canCopy = isSubmitted && status === "IN_PROGRESS";
  const numCols = isCurrentRow ? Math.max(cols, guess.length) : cols;
  const showActive = isCurrentRow && status === "IN_PROGRESS" && !editingToggled;
  const activeIndex = showActive ? guess.length : -1;
  const {
    gramStart,
    hasGram,
    gridColumnStart,
    charsForTile,
    feedbackForTile
  } = useGramPosition({ guess, gram, feedback, isCurrentRow });
  const tiles = [];
  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    const hiddenByGram = hasGram && (colIndex === gramStart || colIndex === gramStart + 1);
    const isFilled = colIndex < guess.length;
    const isActive = colIndex === activeIndex && !hiddenByGram && colIndex < cols;
    tiles.push(
      /* @__PURE__ */ jsx(
        GuessTile,
        {
          char: guess[colIndex] ?? "",
          feedback: feedback?.[colIndex],
          hidden: hiddenByGram,
          index: colIndex,
          editable: isCurrentRow && isFilled && !hiddenByGram,
          active: isActive
        },
        colIndex
      )
    );
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      role: canCopy ? "button" : void 0,
      tabIndex: canCopy ? 0 : void 0,
      onClick: canCopy ? () => setGuess(guess) : void 0,
      onKeyDown: canCopy ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setGuess(guess);
        }
      } : void 0,
      className: clsx(
        "row relative gap-[2px] p-1",
        isFirstRow && "rounded-t-lg",
        isLastRow && "rounded-b-lg",
        canCopy && "cursor-pointer"
      ),
      children: [
        tiles,
        /* @__PURE__ */ jsx(
          GramTile,
          {
            chars: charsForTile,
            feedback: feedbackForTile,
            columnStart: gridColumnStart,
            show: hasGram,
            leftIndex: gramStart,
            rightIndex: gramStart + 1,
            editable: isCurrentRow
          }
        )
      ]
    }
  );
}
function useTilePopAnimation(root) {
  const scope = useRef(null);
  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate(".tile:not(.tile-wide)", {
        scale: [
          {
            to: TILE_POP_PEAK_SCALE,
            ease: "inOut(3)",
            duration: TILE_POP_PEAK_DURATION_MS
          },
          { to: 1, ease: spring({ bounce: TILE_POP_SPRING_BOUNCE }) }
        ]
      });
    });
    return () => scope.current?.revert();
  }, [root]);
}
function SkeletonScoreboard() {
  const scaleStyle = {
    "--sb-px": "calc(8px + (var(--tile-size, 52px) - 36px) * 0.25)",
    "--sb-py": "calc(4px + (var(--tile-size, 52px) - 36px) * 0.15)",
    "--sb-badge": "calc(20px + (var(--tile-size, 52px) - 36px) * 0.4)",
    "--sb-font": "calc(11px + (var(--tile-size, 52px) - 36px) * 0.12)"
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "select-none flex w-full items-stretch justify-between overflow-hidden rounded-full border border-zinc-200 bg-white whitespace-nowrap inset-shadow-default border-t-zinc-300/80 border-zinc-200/50 dark:border-zinc-700/80 dark:border-t-zinc-500/50 dark:border-zinc-800 dark:bg-zinc-900 mb-2",
      style: { ...scaleStyle, fontSize: "var(--sb-font)" },
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center gap-1.5",
            style: { padding: "var(--sb-py) var(--sb-px)" },
            children: [
              /* @__PURE__ */ jsx("span", { className: "font-semibold uppercase tracking-wide text-accent", children: "No." }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: "skeleton-shimmer rounded-md",
                  style: {
                    height: "var(--sb-badge)",
                    width: "calc(var(--sb-badge) * 1.6)"
                  }
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center gap-1.5 border-l border-r border-zinc-200 dark:border-zinc-800",
            style: { padding: "var(--sb-py) var(--sb-px)" },
            children: [
              /* @__PURE__ */ jsx("span", { className: "font-semibold uppercase tracking-wide text-accent", children: "Gram:" }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: "skeleton-shimmer rounded-md",
                  style: {
                    height: "var(--sb-badge)",
                    width: "calc(var(--sb-badge) * 2)"
                  }
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "flex items-center gap-1.5",
            style: { padding: "var(--sb-py) var(--sb-px)" },
            children: /* @__PURE__ */ jsx(
              "span",
              {
                className: "skeleton-shimmer rounded-md",
                style: {
                  height: "var(--sb-badge)",
                  width: "calc(var(--sb-badge) * 3)"
                }
              }
            )
          }
        )
      ]
    }
  );
}
function SkeletonRow({ cols, isFirstRow, isLastRow }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: clsx(
        "row relative gap-[2px] p-1",
        isFirstRow && "rounded-t-lg",
        isLastRow && "rounded-b-lg"
      ),
      "aria-hidden": "true",
      children: Array.from({ length: cols }, (_, i) => /* @__PURE__ */ jsx(
        "div",
        {
          className: "tile tile-skeleton",
          style: { animationDelay: `${i * 80}ms` }
        },
        i
      ))
    }
  );
}
function Guesses({
  gram,
  date,
  puzzleNumber,
  difficulty,
  cols = WORD_LENGTH,
  isLoading = false,
  initialGuesses,
  initialFeedback
}) {
  const storeGuesses = useGameStore((s) => s.guesses);
  const storeFeedback = useGameStore((s) => s.feedback);
  const storeCurrentGuessIndex = useGameStore((s) => s.currentGuessIndex);
  const hasStoreData = storeGuesses.length > 0;
  const guesses = hasStoreData ? storeGuesses : initialGuesses ?? [];
  const feedback = hasStoreData ? storeFeedback : initialFeedback ?? [];
  const currentGuessIndex = hasStoreData ? storeCurrentGuessIndex : initialGuesses?.length ?? 0;
  const root = useRef(null);
  useTilePopAnimation(root);
  const maxBoardWidth = cols * MAX_TILE_SIZE + (cols - 1) * TILE_GAP + ROW_PADDING * 2;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "mx-auto w-full flex grow justify-center items-center",
      style: { maxWidth: `min(95vw, ${maxBoardWidth}px)` },
      children: /* @__PURE__ */ jsxs("div", { className: "w-full flex flex-col items-center", children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            ref: root,
            className: "flex flex-col bg-default justify-center shadow-lg rounded-lg p-1",
            style: {
              width: `calc(var(--cols, ${cols}) * var(--tile-size, ${MAX_TILE_SIZE}px) + (var(--cols, ${cols}) - 1) * var(--tile-gap, ${TILE_GAP}px) + ${ROW_PADDING * 4}px)`
            },
            children: [
              isLoading ? /* @__PURE__ */ jsx(SkeletonScoreboard, {}) : /* @__PURE__ */ jsx(
                Scoreboard,
                {
                  gram,
                  date,
                  puzzleNumber,
                  difficulty
                }
              ),
              Array.from(
                { length: MAX_GUESSES },
                (_, rowIndex) => isLoading ? /* @__PURE__ */ jsx(
                  SkeletonRow,
                  {
                    cols,
                    isFirstRow: rowIndex === 0,
                    isLastRow: rowIndex === MAX_GUESSES - 1
                  },
                  rowIndex
                ) : /* @__PURE__ */ jsx(
                  GuessRow,
                  {
                    guess: guesses[rowIndex] ?? "",
                    feedback: feedback[rowIndex],
                    gram,
                    cols,
                    isCurrentRow: rowIndex === currentGuessIndex,
                    isFirstRow: rowIndex === 0,
                    isLastRow: rowIndex === MAX_GUESSES - 1
                  },
                  rowIndex
                )
              )
            ]
          }
        ),
        isLoading && /* @__PURE__ */ jsx(
          "div",
          {
            className: "mt-4 self-center text-xs uppercase tracking-wider text-accent",
            role: "status",
            "aria-live": "polite",
            children: "Loading the board..."
          }
        )
      ] })
    }
  );
}
const validKeys = [
  "Q",
  "W",
  "E",
  "R",
  "T",
  "Y",
  "U",
  "I",
  "O",
  "P",
  "A",
  "S",
  "D",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "Z",
  "X",
  "C",
  "V",
  "B",
  "N",
  "M",
  "`",
  "Backspace",
  "Delete",
  "Blank",
  "Gram",
  "Space",
  "Enter"
];
const KeyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["spacer", "A", "S", "D", "F", "G", "H", "J", "K", "L", "spacer"],
  ["spacer", "Z", "X", "C", "V", "B", "N", "M", "Backspace"],
  ["Blank", "Gram", "Enter"]
];
const getNormalizedKey = (key) => {
  switch (key) {
    case "Backspace":
    case "Delete":
      return "Backspace";
    case "Gram":
    case "`":
      return "Gram";
    case "Enter":
      return "Enter";
    case "Blank":
    case "Space":
    case " ":
      return "Blank";
    default:
      return key.toUpperCase();
  }
};
function dispatchKey(key, modifier) {
  const { appendChar, backspace, clearGuess, setSkipGramAnimation } = useGameStore.getState();
  switch (key) {
    case "Backspace":
      modifier ? clearGuess() : backspace();
      break;
    case "Enter":
      break;
    case "Blank":
      appendChar(" ");
      break;
    case "Gram": {
      const { gram, guesses, currentGuessIndex } = useGameStore.getState();
      const currentGuess = guesses[currentGuessIndex] ?? "";
      if (!gram) break;
      const upperGram = gram.toUpperCase();
      if (currentGuess.includes(upperGram)) break;
      let overlap = 0;
      for (let k = upperGram.length - 1; k > 0; k--) {
        if (currentGuess.endsWith(upperGram.slice(0, k))) {
          overlap = k;
          break;
        }
      }
      const toAppend = upperGram.slice(overlap);
      if (currentGuess.length + toAppend.length > 6) break;
      setSkipGramAnimation(true);
      for (const c of toAppend) {
        appendChar(c);
      }
      break;
    }
    default:
      appendChar(key);
      break;
  }
}
function handleEditingKey(normalizedKey) {
  const { editing, editKey, setCharAt, removeCharAt } = useGameStore.getState();
  if (!editing.toggled) return false;
  if (normalizedKey === "Enter") {
    editKey(editing.key, false);
    return true;
  }
  if (normalizedKey === "Backspace") {
    removeCharAt(editing.key);
    editKey(editing.key, false);
    return true;
  }
  if (normalizedKey === "Blank") {
    setCharAt(editing.key, " ");
    return true;
  }
  if (/^[A-Z]$/.test(normalizedKey)) {
    setCharAt(editing.key, normalizedKey);
    return true;
  }
  return true;
}
function useKeyboardInput(focusedKeyIndex = null, allKeys = [], onSubmit) {
  const isPaused = useGameStore((s) => s.isPaused);
  const editingToggled = useGameStore((s) => s.editing.toggled);
  const editingKey = useGameStore((s) => s.editing.key);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const longPressTimeoutRef = useRef(
    null
  );
  const longPressIntervalRef = useRef(
    null
  );
  const clearLongPressTimers = () => {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (longPressIntervalRef.current !== null) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  };
  const isRepeatableKey = (key) => key === "Backspace" || key === "Blank" || /^[A-Z]$/.test(key);
  const startLongPressRepeat = (key) => {
    clearLongPressTimers();
    longPressTimeoutRef.current = setTimeout(() => {
      longPressIntervalRef.current = setInterval(() => {
        const { isPaused: paused, status, editing } = useGameStore.getState();
        if (paused || status !== "IN_PROGRESS" || editing.toggled) {
          clearLongPressTimers();
          return;
        }
        dispatchKey(key, false);
      }, 60);
    }, 200);
  };
  const removeSelectedKey = (key) => {
    setSelectedKeys(
      (prev) => prev.filter((selectedKey) => selectedKey !== key)
    );
  };
  const addSelectedKey = (key) => {
    setSelectedKeys((prev) => [...prev, key]);
  };
  const handleKeyPointerDown = (key) => {
    const normalizedKey = getNormalizedKey(key);
    if (!validKeys.includes(normalizedKey)) {
      return;
    }
    if (handleEditingKey(normalizedKey)) {
      return;
    }
    const parsedKey = parseKey({ key, remove: false });
    if (parsedKey === "Enter") {
      onSubmit?.();
      return;
    }
    dispatchKey(parsedKey, false);
    if (isRepeatableKey(parsedKey)) {
      startLongPressRepeat(parsedKey);
    }
  };
  const handleKeyPointerUp = (key) => {
    clearLongPressTimers();
    removeSelectedKey(key);
  };
  const handleKeyboardPress = (event) => {
    let { key } = event;
    const activeElement = document.activeElement;
    const { isPaused: paused, status } = useGameStore.getState();
    if (paused || status !== "IN_PROGRESS") {
      return;
    }
    if (key === "Escape") {
      const { editing, editKey } = useGameStore.getState();
      if (editing.toggled) editKey(editing.key, false);
      return;
    }
    const normalizedKey = getNormalizedKey(key);
    if (normalizedKey !== "Enter") {
      activeElement?.blur();
    }
    if (!validKeys.includes(normalizedKey)) {
      return;
    }
    if (handleEditingKey(normalizedKey)) {
      return;
    }
    const modifier = event.shiftKey || event.ctrlKey || event.metaKey;
    if (normalizedKey === "Enter" && focusedKeyIndex !== null && focusedKeyIndex >= 0 && focusedKeyIndex < allKeys.length) {
      const focusedKey = allKeys[focusedKeyIndex];
      if (focusedKey && focusedKey !== "Enter") {
        const parsedKey2 = parseKey({ key: focusedKey, remove: false });
        dispatchKey(parsedKey2, modifier);
        return;
      }
    }
    const parsedKey = parseKey({ key: normalizedKey, remove: false });
    if (parsedKey === "Enter") {
      onSubmit?.();
      return;
    }
    dispatchKey(parsedKey, modifier);
  };
  const handleKeyboardRelease = (event) => {
    let { key } = event;
    setSelectedKeys([]);
    const normalizedKey = getNormalizedKey(key);
    if (normalizedKey) {
      parseKey({
        key: normalizedKey,
        remove: true
      });
    }
  };
  const parseKey = (options) => {
    let { key, remove } = options;
    const normalizedKey = getNormalizedKey(key);
    if (remove) {
      removeSelectedKey(normalizedKey);
    } else {
      addSelectedKey(normalizedKey);
    }
    return normalizedKey;
  };
  useEffect(() => {
    const handlePointerUp = () => {
      clearLongPressTimers();
      setSelectedKeys([]);
    };
    document.addEventListener("keydown", handleKeyboardPress);
    document.addEventListener("keyup", handleKeyboardRelease);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("keydown", handleKeyboardPress);
      document.removeEventListener("keyup", handleKeyboardRelease);
      document.removeEventListener("pointerup", handlePointerUp);
      clearLongPressTimers();
    };
  }, [isPaused, focusedKeyIndex, allKeys, onSubmit]);
  useEffect(() => {
    if (!editingToggled) return;
    const onPointerDown = (e) => {
      const target = e.target;
      if (!target) return;
      if (target.closest("[data-editable-tile]")) return;
      if (target.closest("[data-keyboard-container]")) return;
      useGameStore.getState().editKey(editingKey, false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editingToggled, editingKey]);
  return {
    selectedKeys,
    setSelectedKeys,
    handleKeyPointerDown,
    handleKeyPointerUp
  };
}
const CLUSTER_NAMES = [
  // Cluster 0 (left third)
  [
    ["Q", "A", "Z", "Blank"],
    ["W", "S", "X", "Blank"],
    ["E", "D", "X", "Blank"]
  ],
  // Cluster 1 (middle third)
  [
    ["R", "F", "C", "Gram"],
    ["T", "G", "V", "Gram"],
    ["Y", "H", "B", "Gram"],
    ["U", "H", "B", "Gram"]
  ],
  // Cluster 2 (right third)
  [
    ["I", "J", "N", "Enter"],
    ["O", "K", "M", "Enter"],
    ["P", "L", "Backspace", "Enter"]
  ]
];
function useKeyboardNavigation(keyButtonRefs) {
  const [focusedKeyIndex, setFocusedKeyIndex] = useState(null);
  const currentTrackForKey = useRef(/* @__PURE__ */ new Map());
  const allKeys = useMemo(
    () => KeyboardRows.flat().filter((key) => key !== "spacer"),
    []
  );
  const clusters = useMemo(() => {
    const keyToIndex = new Map(allKeys.map((key, i) => [key, i]));
    return CLUSTER_NAMES.map(
      (cluster) => cluster.map(
        (column) => column.map((key) => keyToIndex.get(key) ?? -1)
      )
    );
  }, [allKeys]);
  const getClusterPosition = useCallback(
    (flattenedIndex) => {
      if (currentTrackForKey.current.has(flattenedIndex)) {
        const tracked = currentTrackForKey.current.get(flattenedIndex);
        const column = clusters[tracked.clusterIndex][tracked.columnIndex];
        const rowInColumn = column.indexOf(flattenedIndex);
        if (rowInColumn !== -1) {
          return { ...tracked, rowInColumn };
        }
      }
      for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
        const cluster = clusters[clusterIndex];
        for (let columnIndex = 0; columnIndex < cluster.length; columnIndex++) {
          const column = cluster[columnIndex];
          const rowInColumn = column.indexOf(flattenedIndex);
          if (rowInColumn !== -1) {
            return { clusterIndex, columnIndex, rowInColumn };
          }
        }
      }
      return null;
    },
    [clusters]
  );
  const focusKeyByIndex = useCallback(
    (index) => {
      if (index < 0 || index >= allKeys.length) {
        return;
      }
      const button = keyButtonRefs.current[index];
      if (button) {
        button.focus();
        setFocusedKeyIndex(index);
      }
    },
    [allKeys.length, keyButtonRefs]
  );
  const handleArrowKeyNavigation = useCallback(
    (event) => {
      let newIndex = null;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          newIndex = focusedKeyIndex !== null && focusedKeyIndex > 0 ? focusedKeyIndex - 1 : allKeys.length - 1;
          if (newIndex !== null) {
            currentTrackForKey.current.delete(newIndex);
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          newIndex = focusedKeyIndex !== null && focusedKeyIndex < allKeys.length - 1 ? focusedKeyIndex + 1 : 0;
          if (newIndex !== null) {
            currentTrackForKey.current.delete(newIndex);
          }
          break;
        case "ArrowUp": {
          event.preventDefault();
          if (focusedKeyIndex === null) {
            return;
          }
          const currentClusterPos = getClusterPosition(focusedKeyIndex);
          if (currentClusterPos) {
            const { clusterIndex, columnIndex, rowInColumn } = currentClusterPos;
            const column = clusters[clusterIndex][columnIndex];
            const newRowInColumn = rowInColumn > 0 ? rowInColumn - 1 : column.length - 1;
            newIndex = column[newRowInColumn];
            if (newIndex !== null) {
              currentTrackForKey.current.set(newIndex, { clusterIndex, columnIndex });
            }
          }
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          if (focusedKeyIndex === null) {
            return;
          }
          const currentClusterPosDown = getClusterPosition(focusedKeyIndex);
          if (currentClusterPosDown) {
            const { clusterIndex, columnIndex, rowInColumn } = currentClusterPosDown;
            const column = clusters[clusterIndex][columnIndex];
            const newRowInColumn = rowInColumn < column.length - 1 ? rowInColumn + 1 : 0;
            newIndex = column[newRowInColumn];
            if (newIndex !== null) {
              currentTrackForKey.current.set(newIndex, { clusterIndex, columnIndex });
            }
          }
          break;
        }
        default:
          return;
      }
      if (newIndex !== null) {
        focusKeyByIndex(newIndex);
      }
    },
    [focusedKeyIndex, allKeys, clusters, getClusterPosition, focusKeyByIndex]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleArrowKeyNavigation);
    return () => {
      document.removeEventListener("keydown", handleArrowKeyNavigation);
    };
  }, [handleArrowKeyNavigation]);
  useEffect(() => {
    if (focusedKeyIndex !== null && focusedKeyIndex >= 0 && keyButtonRefs.current[focusedKeyIndex]) {
      keyButtonRefs.current[focusedKeyIndex]?.focus();
    }
  }, [focusedKeyIndex]);
  return {
    allKeys,
    focusedKeyIndex,
    focusKeyByIndex,
    setFocusedKeyIndex
  };
}
const FEEDBACK_RANK = {
  correct: 3,
  misplaced: 2,
  absent: 1
};
function normalizeFeedback(f) {
  if (f === "misplaced" || f === "gramMisplaced") return "misplaced";
  if (f === "correct" || f === "gramCorrect") return "correct";
  if (f === "absent") return "absent";
  return null;
}
function useKeyFeedback() {
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);
  return useMemo(() => {
    const map = {};
    let gramFb = null;
    for (let i = 0; i < feedback.length; i++) {
      const guess = guesses[i] ?? "";
      const row = feedback[i] ?? [];
      for (let j = 0; j < row.length; j++) {
        const char = guess[j]?.toUpperCase();
        if (!char) continue;
        const raw = row[j];
        const norm = normalizeFeedback(raw);
        if (!norm) continue;
        if (raw === "gramCorrect" || raw === "gramMisplaced") {
          if (!gramFb || FEEDBACK_RANK[norm] > FEEDBACK_RANK[gramFb]) {
            gramFb = norm;
          }
          continue;
        }
        const existing = map[char];
        if (!existing || FEEDBACK_RANK[norm] > FEEDBACK_RANK[existing]) {
          map[char] = norm;
        }
      }
    }
    return { keyFeedback: map, gramFeedback: gramFb };
  }, [guesses, feedback]);
}
function useSubmitGuess() {
  const submit = useCallback(async () => {
    const state = useGameStore.getState();
    const {
      guesses,
      currentGuessIndex,
      gram,
      status,
      loading,
      setLoading,
      setToast,
      submitGuess
    } = state;
    if (loading) return;
    if (status !== "IN_PROGRESS") return;
    const guess = (guesses[currentGuessIndex] ?? "").toUpperCase();
    if (guess.length < MIN_GUESS_LENGTH || guess.length > WORD_LENGTH) {
      setToast({
        type: "error",
        message: `Guess must be ${MIN_GUESS_LENGTH}-${WORD_LENGTH} letters.`
      });
      return;
    }
    if (gram && !guess.includes(gram)) {
      setToast({
        type: "error",
        message: `Guess must contain the gram "${gram}".`
      });
      return;
    }
    const committed = guesses.slice(0, currentGuessIndex);
    if (committed.includes(guess)) {
      setToast({ type: "warning", message: "Already guessed that word." });
      return;
    }
    setToast(null);
    setLoading(true);
    try {
      const result = await submitGuessServerFn({ data: { guess } });
      submitGuess(
        result.feedback,
        result.status,
        result.word
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit guess.";
      console.error("submitGuess failed:", err);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);
  return { submit };
}
function KeyButton({
  active,
  keyButtonRefs,
  children,
  keyIndex,
  keyName,
  setFocusedKeyIndex,
  feedbackClass
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref: (el) => {
        if (keyIndex >= 0) {
          keyButtonRefs.current[keyIndex] = el;
        }
      },
      "data-key-name": keyName,
      "data-key-index": keyIndex,
      "data-state": active ? "active" : "inactive",
      onFocus: () => setFocusedKeyIndex(keyIndex),
      onBlur: () => setFocusedKeyIndex(null),
      className: "keyboard-key",
      children: /* @__PURE__ */ jsx(
        "span",
        {
          "data-key-name": keyName,
          "data-active": active ? "" : void 0,
          className: clsx("keyboard-key-char", feedbackClass),
          children
        }
      )
    }
  );
}
const KEY_FEEDBACK_CLASSES = {
  correct: "keyboard-key-correct",
  misplaced: "keyboard-key-misplaced",
  absent: "keyboard-key-absent"
};
const ROW_GRID_CLASSES = [
  "grid-cols-10",
  "[grid-template-columns:0.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_0.5fr]",
  "[grid-template-columns:1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr]",
  "[grid-template-columns:repeat(3,1fr)]"
];
function KeyboardRow({
  row,
  rowIndex,
  allKeys,
  selectedKeys,
  keyFeedback,
  gramFeedback,
  gram,
  keyButtonRefs,
  setFocusedKeyIndex
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: clsx(
        "mb-2 grid w-full touch-manipulation px-2",
        ROW_GRID_CLASSES[rowIndex]
      ),
      children: row.map((key, index) => {
        if (key === "spacer") {
          return /* @__PURE__ */ jsx("div", {}, `spacer-${rowIndex}-${index}`);
        }
        const active = selectedKeys.includes(key);
        const keyIndex = allKeys.indexOf(key);
        const reactKey = `row-${rowIndex}-key-${index}-${key}`;
        const sharedProps = {
          active,
          keyName: key,
          keyIndex,
          keyButtonRefs,
          setFocusedKeyIndex
        };
        if (key === "Backspace") {
          return /* @__PURE__ */ jsx(KeyButton, { ...sharedProps, children: /* @__PURE__ */ jsx(Delete, { size: "1.25em" }) }, reactKey);
        }
        if (key === "Gram") {
          return /* @__PURE__ */ jsx(
            KeyButton,
            {
              ...sharedProps,
              feedbackClass: gramFeedback ? KEY_FEEDBACK_CLASSES[gramFeedback] : void 0,
              children: gram ? gram.toUpperCase() : "ST"
            },
            reactKey
          );
        }
        const status = keyFeedback[key];
        const feedbackClass = status ? KEY_FEEDBACK_CLASSES[status] : void 0;
        return /* @__PURE__ */ jsx(KeyButton, { ...sharedProps, feedbackClass, children: key }, reactKey);
      })
    }
  );
}
function Keyboard() {
  const keyButtonRefs = useRef([]);
  const { allKeys, focusedKeyIndex, setFocusedKeyIndex } = useKeyboardNavigation(keyButtonRefs);
  const gram = useGameStore((s) => s.gram);
  const status = useGameStore((s) => s.status);
  const isGameOver = status !== "IN_PROGRESS";
  const { keyFeedback, gramFeedback } = useKeyFeedback();
  const { submit } = useSubmitGuess();
  const { selectedKeys, handleKeyPointerDown, handleKeyPointerUp } = useKeyboardInput(focusedKeyIndex, allKeys, submit);
  const handlePointer = (handler) => (e) => {
    if (isGameOver) return;
    const target = e.target;
    const keyElement = target.closest("[data-key-name]");
    const keyName = keyElement?.dataset?.keyName;
    if (keyName) handler(keyName);
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "w-full py-1 select-none",
      "data-keyboard-container": true,
      onPointerDown: handlePointer(handleKeyPointerDown),
      onPointerUp: handlePointer(handleKeyPointerUp),
      children: KeyboardRows.map((row, rowIndex) => /* @__PURE__ */ jsx(
        KeyboardRow,
        {
          row,
          rowIndex,
          allKeys,
          selectedKeys,
          keyFeedback,
          gramFeedback,
          gram,
          keyButtonRefs,
          setFocusedKeyIndex
        },
        `row-${rowIndex}`
      ))
    }
  );
}
function useStatsRecorder(opts) {
  const { isAuthed, puzzleNumber } = opts;
  const status = useGameStore((s) => s.status);
  const guesses = useGameStore((s) => s.guesses);
  const queryClient = useQueryClient();
  const recordedRef = useRef(null);
  useEffect(() => {
    if (status === "IN_PROGRESS") return;
    if (recordedRef.current === puzzleNumber) return;
    recordedRef.current = puzzleNumber;
    const guessCount = status === "WON" ? guesses.filter((g) => g.length > 0).length : 0;
    if (isAuthed) {
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
      return;
    }
    const lastNumber = useStatsStore.getState().stats.lastPuzzleNumber;
    if (lastNumber === puzzleNumber) return;
    useStatsStore.getState().applyTerminal(status, guessCount, puzzleNumber);
  }, [status, puzzleNumber, isAuthed, guesses, queryClient]);
}
function Home() {
  const {
    user,
    daily: data
  } = Route.useRouteContext();
  useStatsRecorder({
    isAuthed: !!user,
    puzzleNumber: data.puzzleNumber
  });
  const storeStatus = useGameStore((s) => s.status);
  const storeHasData = useGameStore((s) => s.guesses.length > 0);
  const openEndGameDialog = useEndGameDialogStore((s) => s.setIsOpen);
  const setIsAppHydrated = useEndGameDialogStore((s) => s.setIsAppHydrated);
  const effectiveStatus = storeHasData ? storeStatus : data.gameState?.status ?? "IN_PROGRESS";
  const isGameOver = effectiveStatus !== "IN_PROGRESS";
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (user) {
      useGameStore.setState({
        date: data.date,
        gram: data.gram,
        guesses: data.gameState?.guesses ?? [],
        feedback: data.gameState?.feedback ?? [],
        currentGuessIndex: data.gameState?.guesses.length ?? 0,
        status: data.gameState?.status ?? "IN_PROGRESS",
        revealedWord: data.gameState?.word ?? null
      });
      setIsAppHydrated(true);
      if (useGameStore.getState().status !== "IN_PROGRESS") {
        openEndGameDialog(true);
      }
      return;
    }
    const store = useGameStore;
    const {
      setDailyPuzzle,
      resetSession
    } = store.getState();
    const finish = () => {
      if (store.getState().status !== "IN_PROGRESS") {
        openEndGameDialog(true);
      }
      setIsLoading(false);
      setIsAppHydrated(true);
    };
    const hasPersisted = window.localStorage.getItem("grammble-game") !== null;
    if (hasPersisted) {
      setIsLoading(true);
      store.persist.rehydrate()?.then(() => {
        store.getState().setDailyPuzzle(data.date, data.gram);
        finish();
      });
    } else {
      resetSession();
      setDailyPuzzle(data.date, data.gram);
      finish();
    }
  }, [data, user]);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-4 h-[calc(100svh-84px)]", suppressHydrationWarning: true, children: [
    /* @__PURE__ */ jsx(Guesses, { gram: data.gram, date: data.date, puzzleNumber: data.puzzleNumber, difficulty: data.difficulty, isLoading, initialGuesses: data.gameState?.guesses, initialFeedback: data.gameState?.feedback }),
    isLoading ? null : isGameOver ? /* @__PURE__ */ jsx("div", { className: "flex justify-center p-4", children: /* @__PURE__ */ jsx(Button, { onClick: () => openEndGameDialog(true), children: "View results" }) }) : /* @__PURE__ */ jsx(Keyboard, {}),
    /* @__PURE__ */ jsx(EndGameDialog, { puzzleNumber: data.puzzleNumber, difficulty: data.difficulty, isAuthed: !!user, initialStats: data.stats })
  ] });
}
export {
  Home as component
};
