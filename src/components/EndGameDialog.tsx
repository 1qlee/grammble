import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import Dialog from "~/components/ui/Dialog";
import { useGameStore } from "~/stores/game-store";
import { useStatsStore } from "~/stores/stats-store";
import { useEndGameDialogStore } from "~/hooks/useEndGameDialog";
import {
  GAME_MODES,
  MAX_GUESSES,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import { buildShareText, type Difficulty } from "~/utils/game/share";
import { renderGridImage } from "~/utils/game/grid-image";
import { useTheme } from "~/utils/providers/theme-provider";
import { useSettings } from "~/utils/providers/settings-provider";
import {
  EMPTY_STATS,
  derivePreviousStats,
  type Stats,
} from "~/utils/game/stats";
import { getUserStatsServerFn } from "~/utils/trpc/server-caller";
import ArchiveButton from "./game/ArchiveButton";
import ModeScoreTabs from "./game/ModeScoreTabs";
import { buildModeStatuses } from "./game/modeStatus";
import { archiveDayScoresQueryOptions } from "./game/archive/archiveQueries";
import { TodayBanner } from "./end-game/stats/TodayBanner";
import { ScoreAnalysis } from "./end-game/recap/ScoreAnalysis";
import { usePrefetchGameRecap } from "./end-game/recap/useGameRecap";
import { AnalyzeEntry } from "./end-game/recap/AnalyzeEntry";
import { DistributionChart } from "./end-game/stats/DistributionChart";
import { LifetimeStats } from "./end-game/stats/LifetimeStats";
import { CountdownTimer } from "./end-game/countdown/CountdownTimer";

// Modes whose end-game cascade has already played this session. The reveal runs
// only the first time a mode's stats render (i.e. on completion); reopening the
// dialog or revisiting the mode shows the final values without re-animating.
const animatedModes = new Set<GameMode>();


type EndGameDialogProps = {
  puzzleNumber: number;
  difficulty: Difficulty;
  isAuthed: boolean;
  isPremium: boolean;
  initialStats: Stats;
};

export default function EndGameDialog({
  puzzleNumber,
  difficulty,
  isAuthed,
  isPremium,
  initialStats,
}: EndGameDialogProps) {
  const isOpen = useEndGameDialogStore((s) => s.isOpen);
  const setIsOpen = useEndGameDialogStore((s) => s.setIsOpen);
  // Warm the recap cache the moment the dialog opens (premium only), so tapping the Coach CTA
  // renders the carousel instantly instead of flashing a loading state that resizes the modal.
  usePrefetchGameRecap(isPremium && isOpen);
  // Default view shows results; the Coach entry card toggles into the analysis,
  // which takes over the body until dismissed. Reset on open/mode change so each
  // visit starts on the results view.
  const [showAnalysis, setShowAnalysis] = useState(false);
  const status = useGameStore((s) => s.status);
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);
  const gram = useGameStore((s) => s.gram);
  const revealedWord = useGameStore((s) => s.revealedWord);
  const date = useGameStore((s) => s.date);
  const mode = useGameStore((s) => s.mode);
  const isArchive = useGameStore((s) => s.isArchive);
  const score = useGameStore((s) => s.score) ?? 0;
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const setToast = useGameStore((s) => s.setToast);

  const { data: serverStats } = useQuery({
    queryKey: ["userStats", mode],
    queryFn: () => getUserStatsServerFn({ data: { mode } }),
    enabled: isAuthed,
    initialData: isAuthed ? initialStats : undefined,
    staleTime: Infinity,
  });
  const localStats = useStatsStore((s) => s.stats);
  const stats: Stats = isAuthed ? (serverStats ?? EMPTY_STATS) : localStats;

  // On an archived puzzle the per-mode tabs must reflect that specific date's
  // sessions, not today's. The daily route context only knows today's games, so
  // fetch the archived date's per-mode terminal scores instead.
  const { data: archiveDayScores } = useQuery({
    ...archiveDayScoresQueryOptions(date),
    enabled: isAuthed && isArchive,
  });

  // Today's per-mode results come from the app-load context (all entitled
  // modes). The current mode is overridden with the live store result so a
  // game just finished this session shows immediately rather than the stale
  // load-time state.
  const { dailies } = useRouteContext({ from: "__root__" });
  const scoreByMode = useMemo(() => {
    const map: Partial<Record<GameMode, number | null>> = {};
    if (isArchive) {
      if (archiveDayScores) {
        for (const m of GAME_MODES) {
          const session = archiveDayScores[m];
          if (session) map[m] = session.score;
        }
      }
    } else {
      for (const m of GAME_MODES) {
        const gs = dailies[m]?.gameState;
        if (gs && gs.status !== "IN_PROGRESS") map[m] = gs.score;
      }
    }
    if (status === "WON" || status === "LOST") map[mode] = score;
    return map;
  }, [isArchive, archiveDayScores, dailies, mode, status, score]);

  // Per-mode game state for the keycap colors. The score map above can't express
  // an in-progress mode (only terminal sessions land in it), so derive the full
  // OPEN/IN_PROGRESS/WON/LOST status separately.
  const statusByMode = useMemo(
    () =>
      buildModeStatuses({
        isArchive,
        dailies,
        archiveSessions: archiveDayScores,
        liveMode: mode,
        liveStatus:
          status === "WON" || status === "LOST" ? status : undefined,
      }),
    [isArchive, archiveDayScores, dailies, mode, status],
  );

  const { theme } = useTheme();
  const { colorBlindMode } = useSettings();
  const isInProgress = status === "IN_PROGRESS";
  const won = status === "WON";
  const wordLength = WORD_LENGTH_BY_MODE[mode];
  const guessCount = won
    ? guesses.filter((g) => g.length > 0).length
    : MAX_GUESSES;

  // Decide once per open whether to run the cascade, frozen for the whole open
  // so marking the mode as animated doesn't flip it mid-animation. Children
  // mount when `isOpen` flips true, so this must be resolved during render.
  const animateDecisionRef = useRef<boolean | null>(null);
  let animateCascade = false;
  if (isOpen && !isInProgress) {
    if (animateDecisionRef.current === null) {
      animateDecisionRef.current = !animatedModes.has(mode);
    }
    animateCascade = animateDecisionRef.current;
  } else {
    animateDecisionRef.current = null;
  }
  useEffect(() => {
    if (isOpen && !isInProgress && animateCascade) animatedModes.add(mode);
  }, [isOpen, isInProgress, animateCascade, mode]);

  useEffect(() => {
    setShowAnalysis(false);
  }, [isOpen, mode]);

  const shareParams = useMemo(
    () => ({
      puzzleNumber,
      gram,
      guessCount,
      maxGuesses: MAX_GUESSES,
      won,
      feedback,
      difficulty,
      score,
      colorBlind: colorBlindMode,
    }),
    [puzzleNumber, gram, guessCount, won, feedback, difficulty, score, colorBlindMode],
  );
  // Full version (with emoji grid) for the text-only fallback.
  const shareText = useMemo(() => buildShareText(shareParams), [shareParams]);
  // Caption (no emoji grid) to pair with the image, so the grid isn't duplicated.
  const shareCaption = useMemo(
    () => buildShareText({ ...shareParams, includeGrid: false }),
    [shareParams],
  );

  const winPct = stats.played > 0
    ? Math.round((stats.wins / stats.played) * 100)
    : 0;
  const avgScore = stats.played > 0
    ? Math.round(stats.totalScore / stats.played)
    : 0;

  // Pre-game stats so the lifetime odometers count up from the player's prior
  // values rather than from zero. Authed users have the real pre-game snapshot
  // in `initialStats` (fetched at app load, before this game was recorded);
  // unauthed local stats are already post-game, so reverse the just-finished
  // game out of them instead. Either yields all-zero on a first play.
  const previousStats = useMemo<Stats | null>(
    () =>
      isAuthed
        ? initialStats
        : derivePreviousStats(
          stats,
          won ? "WON" : "LOST",
          guessCount,
          puzzleNumber,
          score,
        ),
    [isAuthed, initialStats, stats, won, guessCount, puzzleNumber, score],
  );
  const previousStatValues = useMemo(() => {
    if (!previousStats) return null;
    return {
      played: previousStats.played,
      winPct: previousStats.played > 0
        ? Math.round((previousStats.wins / previousStats.played) * 100)
        : 0,
      currentStreak: previousStats.currentStreak,
      maxStreak: previousStats.maxStreak,
      avgScore: previousStats.played > 0
        ? Math.round(previousStats.totalScore / previousStats.played)
        : 0,
      bestScore: previousStats.bestScore,
    };
  }, [previousStats]);

  const puzzleDate = useMemo(() => {
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day);
    const monthDay = d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    return { label: `${monthDay}, ${year}`, weekday };
  }, [date]);

  // Works in insecure contexts (e.g. LAN IP on mobile) where
  // navigator.clipboard is unavailable. Text only.
  const legacyCopyText = (text: string): boolean => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      console.error("Legacy copy failed", err);
      return false;
    }
  };

  const copyTextFallback = async () => {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(shareText);
        setToast({ message: "Results copied to clipboard", type: "success" });
        return;
      }
    } catch (err) {
      console.error("clipboard.writeText failed, trying legacy", err);
    }
    if (legacyCopyText(shareText)) {
      setToast({ message: "Results copied to clipboard", type: "success" });
    } else {
      setToast({ message: "Could not copy results", type: "error" });
    }
  };

  const handleCopy = async () => {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    // Only attempt the image when the browser confirms it can write image/png.
    // Firefox mobile exposes ClipboardItem but rejects image writes, so we must
    // check support up front rather than attempt-and-catch: a failed image write
    // consumes the user gesture and the text fallback would then also fail.
    const supportsImage =
      !!nav?.clipboard &&
      typeof window !== "undefined" &&
      "ClipboardItem" in window &&
      typeof nav.clipboard.write === "function" &&
      (typeof ClipboardItem.supports !== "function" ||
        ClipboardItem.supports("image/png"));

    if (supportsImage) {
      try {
        // Pass the blob as a promise so write() is invoked synchronously within
        // the click gesture (required by Safari/Firefox).
        const blobPromise = renderGridImage(
          feedback,
          wordLength,
          theme,
          shareCaption.split("\n"),
          colorBlindMode,
        ).then((blob) => {
          if (!blob) throw new Error("Failed to render grid image");
          return blob;
        });
        await nav!.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
        setToast({ message: "Results copied to clipboard", type: "success" });
        return;
      } catch (err) {
        console.error("Image copy failed, falling back to text", err);
      }
    }

    // Fallback: text + emoji version (insecure contexts fall back to execCommand).
    await copyTextFallback();
  };

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onOpen={pauseGame}
      onClose={resumeGame}
    >
      <div className="p-6 flex h-full min-h-0 flex-col gap-3">
        {!showAnalysis && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArchiveButton
                puzzleNumber={puzzleNumber}
                mode={mode}
                isPremium={isPremium}
              />
              {puzzleDate && (
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold">{puzzleDate.label}</span>
                  <span className="text-xs text-accent">
                    {puzzleDate.weekday}
                  </span>
                </div>
              )}
            </div>
            <ModeScoreTabs
              current={mode}
              isPremium={isPremium}
              scoreByMode={scoreByMode}
              statusByMode={statusByMode}
              archiveDate={isArchive ? date : undefined}
              onLeave={() => setIsOpen(false)}
            />
          </div>
        )}

        {showAnalysis ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setShowAnalysis(false)}
                className="flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
                Back to results
              </button>
              <span className="flex flex-col text-left">
                <span className="text-sm font-bold">
                  Recap (Puzzle {puzzleNumber})
                </span>
                <span className="text-xs text-accent">
                  {puzzleDate ? `${puzzleDate.label} · ` : ""}
                  {WORD_LENGTH_BY_MODE[mode]}-letter
                </span>
              </span>
            </div>
            <ScoreAnalysis isPremium={isPremium} />
          </div>
        ) : (
          <>
            <TodayBanner
              feedback={feedback}
              wordLength={wordLength}
              revealedWord={revealedWord ?? ""}
              score={score}
              animate={animateCascade}
              inProgress={isInProgress}
              onCopy={handleCopy}
            />

            {!isInProgress && (
              <AnalyzeEntry
                isPremium={isPremium}
                onOpen={() => setShowAnalysis(true)}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <DistributionChart
                distribution={stats.distribution}
                highlightRow={won ? guessCount : -1}
                animate={animateCascade}
              />
              <LifetimeStats
                current={{
                  played: stats.played,
                  winPct,
                  currentStreak: stats.currentStreak,
                  maxStreak: stats.maxStreak,
                  avgScore,
                  bestScore: stats.bestScore,
                }}
                previous={previousStatValues}
                streakUp={
                  !isArchive &&
                  stats.currentStreak > (previousStatValues?.currentStreak ?? 0)
                }
                streakDown={
                  !isArchive &&
                  stats.currentStreak < (previousStatValues?.currentStreak ?? 0)
                }
                animate={animateCascade}
              />
            </div>

            <CountdownTimer />
          </>
        )}
      </div>
    </Dialog>
  );
}
