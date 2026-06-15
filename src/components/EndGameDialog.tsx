import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import Dialog from "~/components/ui/Dialog";
import GramBadge from "~/components/GramBadge";
import { useGameStore } from "~/stores/game-store";
import { useStatsStore } from "~/stores/stats-store";
import { useEndGameDialog } from "~/hooks/useEndGameDialog";
import {
  GAME_MODES,
  MAX_GUESSES,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import { buildShareText, type Difficulty } from "~/utils/game/share";
import { EMPTY_STATS, type Stats } from "~/utils/game/stats";
import { pickMessage } from "~/utils/game/end-game-messages.constants";
import { getUserStatsServerFn } from "~/utils/trpc/server-caller";
import ModeScoreTabs from "./game/ModeScoreTabs";
import { TodayBanner } from "./end-game/TodayBanner";
import { DistributionChart } from "./end-game/DistributionChart";
import { LifetimeStats } from "./end-game/LifetimeStats";
import { useCountdown } from "./end-game/useCountdown";

const difficultyBadgeStyles: Record<Difficulty, string> = {
  easy: "text-green-600 dark:text-green-300",
  med: "text-yellow-600 dark:text-yellow-300",
  hard: "text-red-600 dark:text-red-300",
};

const GRAM_FONT_SIZE = 44;

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
  const { isOpen, setIsOpen } = useEndGameDialog();
  const status = useGameStore((s) => s.status);
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);
  const gram = useGameStore((s) => s.gram);
  const date = useGameStore((s) => s.date);
  const mode = useGameStore((s) => s.mode);
  const revealedWord = useGameStore((s) => s.revealedWord);
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

  const countdown = useCountdown();

  // Today's per-mode results come from the app-load context (all entitled
  // modes). The current mode is overridden with the live store result so a
  // game just finished this session shows immediately rather than the stale
  // load-time state.
  const { dailies } = useRouteContext({ from: "__root__" });
  const scoreByMode = useMemo(() => {
    const map: Partial<Record<GameMode, number | null>> = {};
    for (const m of GAME_MODES) {
      const gs = dailies[m]?.gameState;
      if (gs && gs.status !== "IN_PROGRESS") map[m] = gs.score;
    }
    if (status === "WON" || status === "LOST") map[mode] = score;
    return map;
  }, [dailies, mode, status, score]);

  const won = status === "WON";
  const wordLength = WORD_LENGTH_BY_MODE[mode];
  const guessCount = won
    ? guesses.filter((g) => g.length > 0).length
    : MAX_GUESSES;

  const shareText = useMemo(
    () =>
      buildShareText({
        puzzleNumber,
        gram,
        guessCount,
        maxGuesses: MAX_GUESSES,
        won,
        feedback,
        difficulty,
        score,
      }),
    [puzzleNumber, gram, guessCount, won, feedback, difficulty, score],
  );

  const winPct = stats.played > 0
    ? Math.round((stats.wins / stats.played) * 100)
    : 0;
  const avgScore = stats.played > 0
    ? Math.round(stats.totalScore / stats.played)
    : 0;
  const headline = pickMessage(won, guessCount, puzzleNumber);
  const gramLabel = gram.toUpperCase().split("").join("·");

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

  const handleCopy = async () => {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    try {
      if (nav?.clipboard) {
        await nav.clipboard.writeText(shareText);
        setToast({ message: "Results copied to clipboard", type: "success" });
      }
    } catch (err) {
      console.error("Copy failed", err);
      setToast({ message: "Could not copy results", type: "error" });
    }
  };

  if (status === "IN_PROGRESS") return null;

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onOpen={pauseGame}
      onClose={resumeGame}
    >
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p
              className={`${difficultyBadgeStyles[difficulty]} text-xs mb-1`}
            >
              Puzzle {puzzleNumber}
            </p>
            {puzzleDate && (
              <p className="text-xs font-bold">
                {puzzleDate.label}{" "}
                <span className="text-accent">{puzzleDate.weekday}</span>
              </p>
            )}
          </div>
          <ModeScoreTabs
            current={mode}
            isPremium={isPremium}
            scoreByMode={scoreByMode}
            onLeave={() => setIsOpen(false)}
          />
        </div>

        <TodayBanner
          headline={headline}
          currentStreak={stats.currentStreak}
          feedback={feedback}
          wordLength={wordLength}
          revealedWord={revealedWord}
          score={score}
          onCopy={handleCopy}
        />

        <div className="grid grid-cols-2 gap-3">
          <DistributionChart
            distribution={stats.distribution}
            highlightRow={won ? guessCount : -1}
          />
          <LifetimeStats
            played={stats.played}
            winPct={winPct}
            currentStreak={stats.currentStreak}
            maxStreak={stats.maxStreak}
            avgScore={avgScore}
            bestScore={stats.bestScore}
          />
        </div>

        <div className="bg-accent rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-accent">
            Next puzzle
          </p>
          <p className="font-mono text-3xl font-bold tabular-nums">
            {countdown}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
