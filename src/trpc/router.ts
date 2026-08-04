import * as v from "valibot";
import { TRPCError } from "@trpc/server";
import type { TRPCContext } from "./init";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "./init";
import {
  getDateString,
  getDailyPuzzle,
  getAllDailyPuzzles,
} from "~/utils/game/daily-puzzle";
import { getGuessSet } from "~/utils/game/word-list";
import { computeFeedback } from "~/utils/game/feedback";
import { parseGuess } from "~/utils/game/guess-placement";
import type { LetterFeedback } from "~/utils/game/types";
import type { GameRecap } from "~/utils/game/recap";
import {
  MAX_GUESSES,
  GAME_MODES,
  GUESS_MIN_LENGTH_BY_MODE,
  GUESS_MAX_LENGTH_BY_MODE,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import {
  EMPTY_STATS,
  applyTerminalToStats,
  applyArchiveToStats,
  type Stats,
} from "~/utils/game/stats";
import { computePuzzleScore, decomposeScore } from "~/utils/game/score";

const modeSchema = v.picklist(["SIX", "SEVEN", "EIGHT"] as const);

// Prior probability of the gram sitting at each start position across the answer pool, indexed
// by position. Grades the opener's placement bet into its base score (see gradeOpener). Solver is
// server-only, so it is dynamically imported to keep it out of the client bundle.
async function gramFractionsFor(
  mode: GameMode,
  gram: string,
  wordLength: number
): Promise<number[]> {
  const { gramPlacementDistribution } = await import("~/utils/game/solver");
  const stats = await gramPlacementDistribution(mode, gram, wordLength);
  return stats.map((s) => s.fraction);
}

// Answer-length candidates still consistent with the feedback entering each guess. Feeds the score's
// exploration relief: where this is 1, only the answer still fit, so a further probe was forced
// clue-gathering (see accumulateScore). Solver is server-only, hence the dynamic import.
async function poolByGuessFor(
  mode: GameMode,
  gram: string,
  answer: string,
  guesses: string[],
  feedback: LetterFeedback[][]
): Promise<number[]> {
  const { candidatePoolByGuess } = await import("~/utils/game/solver");
  return candidatePoolByGuess({ mode, gram, answer, guesses, feedback });
}

// The gram's valid guess words with the answer removed: the set of legal PROBES a player could have
// used. Scoring/analysis consult it to waive a penalty the player could not have avoided (a known
// letter no other word could carry, a gram with no untried position left). The answer is excluded
// because playing it ends the game, so it is never an alternative to a probe.
function probePoolFrom(
  guessSet: Set<string>,
  gram: string,
  answer: string
): string[] {
  const g = gram.toUpperCase();
  const a = answer.toUpperCase();
  const out: string[] = [];
  for (const w of guessSet) {
    const up = w.toUpperCase();
    if (up !== a && up.includes(g)) out.push(up);
  }
  return out;
}

// Throttle a caller on a named action. Keyed by user id when authed, else by
// client IP, so a flood from one identity can't amplify server work (each
// terminal guess runs the solver). Throws TOO_MANY_REQUESTS past the limit.
// The limiter fails open on a Redis outage (see checkRateLimit).
async function enforceRateLimit(
  ctx: TRPCContext,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const { checkRateLimit } = await import("~/utils/http/rate-limit");
  const identity = ctx.user?.id ?? ctx.clientIp ?? "unknown";
  const { allowed } = await checkRateLimit(
    `${action}:${identity}`,
    limit,
    windowSeconds
  );
  if (!allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "You're doing that too fast. Please wait a moment and try again.",
    });
  }
}

// 6-letter is open to everyone; 7- and 8-letter modes require premium.
function assertModeAllowed(ctx: TRPCContext, mode: GameMode) {
  if (mode !== "SIX" && !ctx.user?.isPremium) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This game mode is available to premium members only.",
    });
  }
}

async function getOrCreateStats(
  prisma: (typeof import("~/utils/db/prisma"))["prismaClient"],
  userId: string,
  mode: GameMode
): Promise<Stats> {
  const row = await prisma.userStats.findUnique({
    where: { userId_mode: { userId, mode } },
  });
  if (!row) return EMPTY_STATS;
  return {
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    currentStreak: row.currentStreak,
    maxStreak: row.maxStreak,
    distribution:
      row.distribution.length === MAX_GUESSES
        ? row.distribution
        : EMPTY_STATS.distribution,
    lastPuzzleNumber: row.lastPuzzleNumber,
    totalScore: row.totalScore,
    bestScore: row.bestScore,
  };
}

async function persistTerminalStats(
  prisma: (typeof import("~/utils/db/prisma"))["prismaClient"],
  userId: string,
  mode: GameMode,
  outcome: "WON" | "LOST",
  guessCount: number,
  puzzleNumber: number,
  score: number
): Promise<void> {
  const prev = await getOrCreateStats(prisma, userId, mode);
  const next = applyTerminalToStats(
    prev,
    outcome,
    guessCount,
    puzzleNumber,
    score
  );
  if (next === prev) return;
  await prisma.userStats.upsert({
    where: { userId_mode: { userId, mode } },
    create: { userId, mode, ...next },
    update: {
      played: next.played,
      wins: next.wins,
      losses: next.losses,
      currentStreak: next.currentStreak,
      maxStreak: next.maxStreak,
      distribution: next.distribution,
      lastPuzzleNumber: next.lastPuzzleNumber,
      totalScore: next.totalScore,
      bestScore: next.bestScore,
    },
  });
}

// Fold a finished archive replay into lifetime stats without touching streak
// state. The update omits currentStreak/maxStreak/lastPuzzleNumber so the
// player's daily streak is preserved exactly; only played/wins/losses,
// distribution, and scores move. See applyArchiveToStats for the rationale.
async function persistArchiveStats(
  prisma: (typeof import("~/utils/db/prisma"))["prismaClient"],
  userId: string,
  mode: GameMode,
  outcome: "WON" | "LOST",
  guessCount: number,
  score: number
): Promise<void> {
  const prev = await getOrCreateStats(prisma, userId, mode);
  const next = applyArchiveToStats(prev, outcome, guessCount, score);
  await prisma.userStats.upsert({
    where: { userId_mode: { userId, mode } },
    create: { userId, mode, ...next },
    update: {
      played: next.played,
      wins: next.wins,
      losses: next.losses,
      distribution: next.distribution,
      totalScore: next.totalScore,
      bestScore: next.bestScore,
    },
  });
}

export type DailyModeData = {
  mode: GameMode;
  date: string;
  gram: string;
  puzzleNumber: number;
  wordLength: number;
  difficulty: "easy" | "med" | "hard";
  gameState: {
    guesses: string[];
    feedback: LetterFeedback[][];
    status: string;
    attemptsRemaining: number;
    word: string | null;
    score: number | null;
  } | null;
  stats: Stats;
};

function difficultyOf(d: "EASY" | "MEDIUM" | "HARD"): "easy" | "med" | "hard" {
  return d === "EASY" ? "easy" : d === "HARD" ? "hard" : "med";
}

export type ArchiveDayStatus = "OPEN" | "IN_PROGRESS" | "WON" | "LOST";

// Per-mode session summary for one archived date. `status` is authoritative for
// coloring (a loss still stores a numeric `score`, so score can't imply won).
export type ArchiveModeSession = {
  status: ArchiveDayStatus;
  score: number | null;
};

export type ArchiveDay = {
  date: string;
  number: number;
  gram: string;
  status: ArchiveDayStatus;
};

export type ArchiveData = {
  year: number;
  month: number;
  days: ArchiveDay[];
  // True when at least one earlier puzzle exists for this mode, so the
  // calendar can disable backwards navigation past the first puzzle.
  hasPrev: boolean;
  monthSolvedCount: number;
  currentStreak: number;
};

async function buildDailyForMode(
  ctx: TRPCContext,
  date: string,
  mode: GameMode,
  puzzle: Awaited<ReturnType<typeof getDailyPuzzle>>
): Promise<DailyModeData> {
  let gameState: DailyModeData["gameState"] = null;
  let stats: Stats = EMPTY_STATS;

  if (ctx.user) {
    const { prismaClient } = await import("~/utils/db/prisma");
    const session = await prismaClient.gameSession.findUnique({
      where: {
        userId_puzzleId: {
          userId: ctx.user.id,
          puzzleId: puzzle.id,
        },
      },
    });

    if (session) {
      gameState = {
        guesses: session.guesses,
        feedback: session.feedback as LetterFeedback[][],
        status: session.status,
        attemptsRemaining: MAX_GUESSES - session.guesses.length,
        word: session.status === "IN_PROGRESS" ? null : puzzle.word,
        score: session.score,
      };
    }

    stats = await getOrCreateStats(prismaClient, ctx.user.id, mode);
  }

  return {
    mode,
    date,
    gram: puzzle.gram.letters,
    puzzleNumber: puzzle.number,
    wordLength: WORD_LENGTH_BY_MODE[mode],
    difficulty: difficultyOf(puzzle.difficulty),
    gameState,
    stats,
  };
}

const gameRouter = createTRPCRouter({
  getDaily: publicProcedure
    .input(v.optional(v.object({ mode: v.optional(modeSchema) })))
    .query(async ({ ctx, input }) => {
      const date = getDateString();
      const mode: GameMode = input?.mode ?? "SIX";
      assertModeAllowed(ctx, mode);
      const puzzle = await getDailyPuzzle(date, mode);
      return buildDailyForMode(ctx, date, mode, puzzle);
    }),

  // Load a single past puzzle (plus the user's prior session for it) so the
  // archive can replay it on the board. Premium-only, like the archive itself.
  getArchivePuzzle: protectedProcedure
    .input(v.object({ mode: modeSchema, date: v.string() }))
    .query(async ({ ctx, input }): Promise<DailyModeData> => {
      const today = getDateString();
      if (input.date > today) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "That puzzle isn't available yet.",
        });
      }
      if (!ctx.user.isPremium) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The puzzle archive is available to premium members only.",
        });
      }
      assertModeAllowed(ctx, input.mode);
      const puzzle = await getDailyPuzzle(input.date, input.mode);
      return buildDailyForMode(ctx, input.date, input.mode, puzzle);
    }),

  getAllDaily: publicProcedure.query(async ({ ctx }) => {
    const date = getDateString();
    // Only fetch modes the user is entitled to: everyone gets 6-letter;
    // 7- and 8-letter are premium-only, so non-premium users never receive
    // their puzzle data.
    const allowedModes = GAME_MODES.filter(
      (mode) => mode === "SIX" || ctx.user?.isPremium
    );
    const puzzles = await getAllDailyPuzzles(date);
    const result: Partial<Record<GameMode, DailyModeData>> = {};
    for (const mode of allowedModes) {
      const puzzle = puzzles.get(mode)!;
      result[mode] = await buildDailyForMode(ctx, date, mode, puzzle);
    }
    return result;
  }),

  getArchive: protectedProcedure
    .input(
      v.object({
        mode: modeSchema,
        year: v.pipe(
          v.number(),
          v.integer(),
          v.minValue(2024),
          v.maxValue(2100)
        ),
        month: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(12)),
      })
    )
    .query(async ({ ctx, input }): Promise<ArchiveData> => {
      // The archive (replaying past puzzles) is a premium-only feature.
      if (!ctx.user.isPremium) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The puzzle archive is available to premium members only.",
        });
      }
      assertModeAllowed(ctx, input.mode);

      const { prismaClient } = await import("~/utils/db/prisma");
      const today = getDateString();
      const monthPrefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const start = `${monthPrefix}-01`;
      const end = `${monthPrefix}-31`;

      const puzzles = await prismaClient.puzzle.findMany({
        where: { mode: input.mode, date: { gte: start, lte: end } },
        include: { gram: true },
        orderBy: { date: "asc" },
      });

      // Never surface puzzles dated after today, even within the current month.
      const visible = puzzles.filter((p) => p.date <= today);

      const sessions = visible.length
        ? await prismaClient.gameSession.findMany({
            where: {
              userId: ctx.user.id,
              puzzleId: { in: visible.map((p) => p.id) },
            },
            select: { puzzleId: true, status: true },
          })
        : [];
      const statusByPuzzle = new Map(
        sessions.map((s) => [s.puzzleId, s.status as ArchiveDayStatus])
      );

      const days: ArchiveDay[] = visible.map((p) => ({
        date: p.date,
        number: p.number,
        gram: p.gram.letters,
        status: statusByPuzzle.get(p.id) ?? "OPEN",
      }));

      const prev = await prismaClient.puzzle.findFirst({
        where: { mode: input.mode, date: { lt: start } },
        select: { id: true },
      });

      const stats = await getOrCreateStats(
        prismaClient,
        ctx.user.id,
        input.mode
      );

      return {
        year: input.year,
        month: input.month,
        days,
        hasPrev: Boolean(prev),
        monthSolvedCount: days.filter((d) => d.status === "WON").length,
        currentStreak: stats.currentStreak,
      };
    }),

  // Per-mode session summary for a single date, used by the archive header tabs
  // to reflect the selected day's results across all modes. A mode appears once
  // it has any session; `status` distinguishes in-progress/won/lost (a loss
  // still carries a numeric score, so the score alone can't tell won from lost).
  getArchiveDayScores: protectedProcedure
    .input(v.object({ date: v.string() }))
    .query(
      async ({
        ctx,
        input,
      }): Promise<Partial<Record<GameMode, ArchiveModeSession>>> => {
        if (!ctx.user.isPremium) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "The puzzle archive is available to premium members only.",
          });
        }
        if (input.date > getDateString()) return {};

        const { prismaClient } = await import("~/utils/db/prisma");
        const puzzles = await prismaClient.puzzle.findMany({
          where: { date: input.date },
          select: { id: true, mode: true },
        });
        if (!puzzles.length) return {};

        const sessions = await prismaClient.gameSession.findMany({
          where: {
            userId: ctx.user.id,
            puzzleId: { in: puzzles.map((p) => p.id) },
          },
          select: { puzzleId: true, status: true, score: true },
        });
        const sessionByPuzzle = new Map(sessions.map((s) => [s.puzzleId, s]));

        const result: Partial<Record<GameMode, ArchiveModeSession>> = {};
        for (const p of puzzles) {
          const session = sessionByPuzzle.get(p.id);
          if (session) {
            result[p.mode as GameMode] = {
              status: session.status as ArchiveDayStatus,
              score: session.score,
            };
          }
        }
        return result;
      }
    ),

  getUserStats: protectedProcedure
    .input(v.object({ mode: modeSchema }))
    .query(async ({ ctx, input }) => {
      const { prismaClient } = await import("~/utils/db/prisma");
      return getOrCreateStats(prismaClient, ctx.user.id, input.mode);
    }),

  // Premium-only, post-game analysis of the caller's own finished session:
  // the solver-derived narrowing story plus the behavioral observations. Gated
  // on premium and on the game being terminal (the recap reveals the answer
  // pool, so it must never be readable mid-game).
  getRecap: protectedProcedure
    .input(v.object({ mode: modeSchema, date: v.string() }))
    .query(async ({ ctx, input }): Promise<GameRecap> => {
      if (!ctx.user.isPremium) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Game analysis is available to premium members only.",
        });
      }

      const puzzle = await getDailyPuzzle(input.date, input.mode);
      const { prismaClient } = await import("~/utils/db/prisma");
      const session = await prismaClient.gameSession.findUnique({
        where: {
          userId_puzzleId: { userId: ctx.user.id, puzzleId: puzzle.id },
        },
      });

      if (!session || session.status === "IN_PROGRESS") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No finished game to analyze.",
        });
      }

      const gram = puzzle.gram.letters;
      const guesses = session.guesses;
      const feedback = session.feedback as LetterFeedback[][];
      const won = session.status === "WON";
      const wordLength = puzzle.word.length;
      // Valid gram words minus the answer: lets the score/coach waive a penalty the player could not
      // have avoided (a known letter no other word could use, a gram with no fresh spot left to try).
      const probePool = probePoolFrom(await getGuessSet(input.mode), gram, puzzle.word);

      const [
        { computeNarrowing, gramPlacementDistribution },
        { analyzeGame },
        { computeLuck },
      ] = await Promise.all([
        import("~/utils/game/solver"),
        import("~/utils/game/analysis"),
        import("~/utils/game/luck"),
      ]);

      const narrowing = await computeNarrowing({
        mode: input.mode,
        gram,
        answer: puzzle.word,
        guesses,
        feedback,
        won,
      });

      // First-guess slide: prior odds of each gram placement, plus where the
      // opener actually placed the gram and whether that earned gramCorrect.
      const positions = await gramPlacementDistribution(
        input.mode,
        gram,
        wordLength
      );
      const firstGuess = guesses[0]?.toUpperCase() ?? "";
      const chosenIndex = firstGuess.indexOf(gram.toUpperCase());
      const gramPlacement = {
        gram: gram.toUpperCase(),
        wordLength,
        gramLength: gram.length,
        positions,
        chosenPosition: chosenIndex >= 0 ? chosenIndex : null,
        chosenAligned: feedback[0]?.includes("gramCorrect") ?? false,
        answerPosition: Math.max(
          0,
          puzzle.word.toUpperCase().indexOf(gram.toUpperCase())
        ),
      };
      const analysis = analyzeGame({
        guesses,
        feedback,
        won,
        wordLength,
        seedSource: `${input.date}:${input.mode}`,
        probePool,
        gram,
      });

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No finished game to analyze.",
        });
      }

      // Skill/luck split of the same score (subsets, not a separate rating). Reuse the gram
      // placement prior already computed above to grade the opener.
      const breakdown = decomposeScore({
        guesses,
        feedback,
        won,
        wordLength,
        gramPositionFractions: positions.map((p) => p.fraction),
        probePool,
        gram,
        // Reuse the narrowing already computed above: perGuess[i].before is the candidate count
        // entering guess i, so no second solver pass is needed for the exploration-relief signal.
        poolByGuess: narrowing.perGuess.map((p) => p.before),
      });

      // How the board treated the player, measured independently of the score (see luck.ts). This
      // is pure end-of-game colour and never feeds computePuzzleScore.
      const luck = await computeLuck({
        mode: input.mode,
        gram,
        answer: puzzle.word,
        guesses,
        feedback,
        won,
      });

      return { narrowing, gramPlacement, analysis, breakdown, luck };
    }),

  submitGuess: publicProcedure
    .input(
      v.object({
        mode: modeSchema,
        guess: v.pipe(v.string(), v.minLength(4), v.maxLength(8)),
        // Prior guesses this session, used only to score the anonymous (no
        // server session) path. Ignored for authed users, who are scored from
        // their trusted DB session.
        history: v.optional(
          v.pipe(v.array(v.string()), v.maxLength(MAX_GUESSES))
        ),
        // The puzzle date the client believes it is playing. Lets the server
        // detect a daily board left open past midnight (stale) and route
        // intentional archive replays to the correct past puzzle.
        date: v.optional(v.string()),
        // True when the client is replaying a past puzzle from the archive.
        archive: v.optional(v.boolean()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generous for real play (max 6 guesses per puzzle across a few modes,
      // plus archive replays) but caps automated floods.
      await enforceRateLimit(ctx, "submit-guess", 40, 60);
      const { mode } = input;
      assertModeAllowed(ctx, mode);
      const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
      const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];
      const wordLength = WORD_LENGTH_BY_MODE[mode];

      // A guess may be placed shorter than the board and slid over, carrying
      // leading blank tiles (spaces). Parse that placement out: `word` is the
      // contiguous letters (validated below), `guess` is the canonical stored
      // string (offset spaces + word) that computeFeedback / scoring read.
      const parsed = parseGuess(input.guess, wordLength);
      if (!parsed.ok) {
        return {
          ok: false as const,
          error:
            parsed.reason === "noncontiguous"
              ? "Letters must be connected, with blanks only on the ends."
              : `Guess must be ${minLen}-${maxLen} letters.`,
        };
      }
      const { spaced: guess, word } = parsed.value;

      // Invalid guesses are a normal part of play, not exceptional conditions.
      // Returning them as a soft result (rather than throwing a TRPCError)
      // keeps both server and client consoles free of spurious error logs;
      // the client surfaces `error` via Toast exactly as before.
      if (word.length < minLen || word.length > maxLen) {
        return {
          ok: false as const,
          error: `Guess must be ${minLen}-${maxLen} letters.`,
        };
      }

      const today = getDateString();
      const date = input.date ?? today;

      if (input.archive) {
        // Replaying a past puzzle from the archive is a premium-only feature.
        if (date > today) {
          return {
            ok: false as const,
            error: "That puzzle isn't available yet.",
          };
        }
        if (!ctx.user?.isPremium) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "The puzzle archive is available to premium members only.",
          });
        }
      } else if (date !== today) {
        // A daily board left open past midnight submits yesterday's date.
        // Reject before scoring so the player refreshes to today's puzzle
        // instead of guessing against a gram they can no longer see.
        return {
          ok: false as const,
          error: "Today's puzzle is ready. Refresh the page to play it.",
        };
      }

      const guessSet = await getGuessSet(mode);
      if (!guessSet.has(word)) {
        return { ok: false as const, error: "Not a valid word." };
      }

      const puzzle = await getDailyPuzzle(date, mode);
      const gram = puzzle.gram.letters;

      if (!word.includes(gram)) {
        return {
          ok: false as const,
          error: `Guess must contain the gram "${gram}".`,
        };
      }

      let existingGuesses: string[] = [];
      let existingFeedback: LetterFeedback[][] = [];
      let prismaClient:
        | (typeof import("~/utils/db/prisma"))["prismaClient"]
        | null = null;

      if (ctx.user) {
        prismaClient = (await import("~/utils/db/prisma")).prismaClient;
        const session = await prismaClient.gameSession.findUnique({
          where: {
            userId_puzzleId: {
              userId: ctx.user.id,
              puzzleId: puzzle.id,
            },
          },
        });

        if (session) {
          if (session.status !== "IN_PROGRESS") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Game already completed.",
            });
          }
          if (session.guesses.length >= MAX_GUESSES) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "No attempts remaining.",
            });
          }
          if (session.guesses.includes(guess)) {
            return { ok: false as const, error: "Already guessed that word." };
          }
          existingGuesses = session.guesses;
          existingFeedback = session.feedback as LetterFeedback[][];
        }
      }

      const feedback = computeFeedback(guess, puzzle.word, gram);

      // Prior guesses for this session: authed users are trusted from their DB
      // session; anon users (no server session) supply their history on the
      // request. Both drive the attempt count so the loss on the final guess
      // fires for anonymous players too, not just the score.
      // Preserve leading blanks (offset); only trailing whitespace is noise.
      const anonHistory = (input.history ?? [])
        .map((g) => g.toUpperCase().replace(/\s+$/, ""))
        .filter((g) => g.trim().length > 0);
      const priorGuesses = ctx.user ? existingGuesses : anonHistory;

      // A win needs the full-length word (offset 0, no blanks) fully correct.
      const isWin =
        word.length === puzzle.word.length &&
        feedback.every((f) => f === "correct" || f === "gramCorrect");
      const attemptNumber = priorGuesses.length + 1;
      const isLoss = !isWin && attemptNumber >= MAX_GUESSES;
      const status = isWin ? "WON" : isLoss ? "LOST" : "IN_PROGRESS";

      // Score is computed server-side so the algorithm never reaches the
      // client. Authed users are scored from their trusted DB history; anon
      // users (no server session) are scored from the client-supplied history,
      // with feedback recomputed here rather than trusted.
      let score: number | undefined;
      if (status === "WON" || status === "LOST") {
        let fullGuesses: string[];
        let fullFeedback: LetterFeedback[][];
        if (ctx.user) {
          fullGuesses = [...existingGuesses, guess];
          fullFeedback = [...existingFeedback, feedback];
        } else {
          fullGuesses = [...anonHistory, guess];
          fullFeedback = fullGuesses.map((g) =>
            computeFeedback(g, puzzle.word, gram)
          );
        }
        score = computePuzzleScore({
          guesses: fullGuesses,
          feedback: fullFeedback,
          won: status === "WON",
          wordLength: puzzle.word.length,
          gramPositionFractions: await gramFractionsFor(
            input.mode,
            gram,
            puzzle.word.length
          ),
          probePool: probePoolFrom(guessSet, gram, puzzle.word),
          gram,
          poolByGuess: await poolByGuessFor(
            input.mode,
            gram,
            puzzle.word,
            fullGuesses,
            fullFeedback
          ),
        });
      }

      if (ctx.user && prismaClient) {
        await prismaClient.gameSession.upsert({
          where: {
            userId_puzzleId: {
              userId: ctx.user.id,
              puzzleId: puzzle.id,
            },
          },
          create: {
            userId: ctx.user.id,
            puzzleId: puzzle.id,
            guesses: [guess],
            feedback: [feedback],
            status,
            score: score ?? null,
            completedAt: status !== "IN_PROGRESS" ? new Date() : undefined,
          },
          update: {
            guesses: [...existingGuesses, guess],
            feedback: [...existingFeedback, feedback],
            status,
            score: score ?? null,
            completedAt: status !== "IN_PROGRESS" ? new Date() : undefined,
          },
        });

        // Archive replays save per-puzzle progress (above) so the calendar
        // reflects WON/LOST. They fold into lifetime totals too (played,
        // distribution, scores) but never the streak: the streak logic is
        // sequential by puzzle number and older puzzles would corrupt
        // currentStreak. A session reaches terminal exactly once (a completed
        // session rejects further guesses above), so this counts each puzzle
        // once without a separate idempotency guard.
        if ((status === "WON" || status === "LOST") && score !== undefined) {
          if (input.archive) {
            await persistArchiveStats(
              prismaClient,
              ctx.user.id,
              mode,
              status,
              attemptNumber,
              score
            );
          } else {
            await persistTerminalStats(
              prismaClient,
              ctx.user.id,
              mode,
              status,
              attemptNumber,
              puzzle.number,
              score
            );
          }
        }
      }

      const result: {
        ok: true;
        feedback: LetterFeedback[];
        status: string;
        attemptsRemaining: number;
        word?: string;
        score?: number;
      } = {
        ok: true,
        feedback,
        status,
        attemptsRemaining: MAX_GUESSES - attemptNumber,
      };

      if (status === "WON" || status === "LOST") {
        result.word = puzzle.word;
        result.score = score;
      }

      return result;
    }),

  syncAnonymousSession: protectedProcedure
    .input(
      v.object({
        mode: modeSchema,
        guesses: v.pipe(
          v.array(v.pipe(v.string(), v.minLength(4), v.maxLength(8))),
          v.maxLength(MAX_GUESSES)
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.guesses.length === 0) {
        return { merged: false as const };
      }

      // One-shot merge on login, but it recomputes feedback and runs the solver
      // for scoring, so cap repeated calls.
      await enforceRateLimit(ctx, "sync-anon", 20, 60);

      const { mode } = input;
      const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
      const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];
      const wordLength = WORD_LENGTH_BY_MODE[mode];

      const date = getDateString();
      const puzzle = await getDailyPuzzle(date, mode);
      const gram = puzzle.gram.letters;

      const guessSet = await getGuessSet(mode);
      // Parse each row's placement (offset spaces + word); the canonical spaced
      // string is what gets scored and stored, `word` is what gets validated.
      const normalizedGuesses = input.guesses.map((raw) => {
        const parsed = parseGuess(raw, wordLength);
        if (!parsed.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              parsed.reason === "noncontiguous"
                ? "Letters must be connected, with blanks only on the ends."
                : `Guess must be ${minLen}-${maxLen} letters.`,
          });
        }
        const { spaced, word } = parsed.value;
        if (word.length < minLen || word.length > maxLen) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Guess must be ${minLen}-${maxLen} letters.`,
          });
        }
        if (!guessSet.has(word)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid guess: ${word}`,
          });
        }
        if (!word.includes(gram)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Guess must contain the gram "${gram}".`,
          });
        }
        return { spaced, word };
      });

      const { prismaClient } = await import("~/utils/db/prisma");

      const existing = await prismaClient.gameSession.findUnique({
        where: {
          userId_puzzleId: {
            userId: ctx.user.id,
            puzzleId: puzzle.id,
          },
        },
      });

      if (existing) {
        return { merged: false as const };
      }

      // The canonical spaced strings carry each row's blank offset; scoring and
      // storage use them, feedback is computed against them (blanks included).
      const spacedGuesses = normalizedGuesses.map((g) => g.spaced);
      const feedback: LetterFeedback[][] = spacedGuesses.map((g) =>
        computeFeedback(g, puzzle.word, gram)
      );

      let status: "IN_PROGRESS" | "WON" | "LOST" = "IN_PROGRESS";
      for (let i = 0; i < normalizedGuesses.length; i++) {
        const { word } = normalizedGuesses[i];
        const fb = feedback[i];
        const isWin =
          word.length === puzzle.word.length &&
          fb.every((f) => f === "correct" || f === "gramCorrect");
        if (isWin) {
          status = "WON";
          break;
        }
        if (i + 1 >= MAX_GUESSES) {
          status = "LOST";
        }
      }

      const score =
        status === "WON" || status === "LOST"
          ? computePuzzleScore({
              guesses: spacedGuesses,
              feedback,
              won: status === "WON",
              wordLength: puzzle.word.length,
              gramPositionFractions: await gramFractionsFor(
                input.mode,
                gram,
                puzzle.word.length
              ),
              probePool: probePoolFrom(guessSet, gram, puzzle.word),
              gram,
              poolByGuess: await poolByGuessFor(
                input.mode,
                gram,
                puzzle.word,
                spacedGuesses,
                feedback
              ),
            })
          : null;

      await prismaClient.gameSession.create({
        data: {
          userId: ctx.user.id,
          puzzleId: puzzle.id,
          guesses: spacedGuesses,
          feedback,
          status,
          score,
          completedAt: status !== "IN_PROGRESS" ? new Date() : undefined,
        },
      });

      if ((status === "WON" || status === "LOST") && score !== null) {
        await persistTerminalStats(
          prismaClient,
          ctx.user.id,
          mode,
          status,
          normalizedGuesses.length,
          puzzle.number,
          score
        );
      }

      return { merged: true as const };
    }),
});

const REFERRAL_MAX_REDEMPTIONS = 5;
const FREE_TRIAL_DAYS = 90;

const billingRouter = createTRPCRouter({
  getPrices: publicProcedure.query(async () => {
    const { stripe } = await import("~/utils/stripe/stripe");
    const isProduction = process.env.NODE_ENV === "production";
    const monthlyPriceId = isProduction
      ? process.env.STRIPE_MONTHLY_PRICE_ID!
      : process.env.STRIPE_MONTHLY_TEST_PRICE_ID!;
    const annualPriceId = isProduction
      ? process.env.STRIPE_ANNUAL_PRICE_ID!
      : process.env.STRIPE_ANNUAL_TEST_PRICE_ID!;

    const [monthly, annual] = await Promise.all([
      stripe.prices.retrieve(monthlyPriceId),
      stripe.prices.retrieve(annualPriceId),
    ]);

    return {
      monthly: { amount: monthly.unit_amount ?? 0, currency: monthly.currency },
      annual: { amount: annual.unit_amount ?? 0, currency: annual.currency },
    };
  }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const { prismaClient } = await import("~/utils/db/prisma");

    const user = await prismaClient.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        isPremium: true,
        premiumGranted: true,
        premiumExpiresAt: true,
        subscription: {
          select: {
            status: true,
            stripePriceId: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    });

    return {
      isPremium: user?.isPremium ?? false,
      premiumGranted: user?.premiumGranted ?? false,
      premiumExpiresAt: user?.premiumExpiresAt ?? null,
      subscription: user?.subscription ?? null,
    };
  }),

  createCheckout: protectedProcedure
    .input(
      v.object({
        interval: v.picklist(["monthly", "annual"]),
        promoCode: v.optional(v.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { stripe } = await import("~/utils/stripe/stripe");
      const { prismaClient } = await import("~/utils/db/prisma");

      const user = await prismaClient.user.findUnique({
        where: { id: ctx.user.id },
        select: { isPremium: true, email: true, subscription: true },
      });

      if (user?.isPremium) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have premium.",
        });
      }

      // Reuse existing Stripe customer if they have one; otherwise let
      // Stripe Checkout create the customer (saved via webhook)
      const existingCustomerId = user?.subscription?.stripeCustomerId;

      // Look up promo code for discount
      let discounts: { coupon: string }[] | undefined;
      // The promo whose coupon is applied to this checkout. Its redemption is
      // recorded (and currentRedemptions incremented) by the Stripe webhook on
      // successful completion, so abandoned checkouts don't burn a slot. The
      // limit check below is the gate that stops a maxed-out code from being
      // applied at all; Stripe's own coupon max_redemptions is the hard backstop.
      let appliedPromoCodeId: string | undefined;
      if (input.promoCode) {
        const promo = await prismaClient.promoCode.findUnique({
          where: { code: input.promoCode.toUpperCase().trim() },
        });

        if (
          promo?.active &&
          promo.type === "DISCOUNT" &&
          promo.stripeCouponId
        ) {
          if (promo.expiresAt && promo.expiresAt < new Date()) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This promo code has expired.",
            });
          }
          if (
            promo.maxRedemptions &&
            promo.currentRedemptions >= promo.maxRedemptions
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This promo code has reached its limit.",
            });
          }
          // Block a user from reusing a discount they have already redeemed.
          const alreadyRedeemed =
            await prismaClient.promoRedemption.findUnique({
              where: {
                userId_promoCodeId: {
                  userId: ctx.user.id,
                  promoCodeId: promo.id,
                },
              },
            });
          if (alreadyRedeemed) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You have already used this code.",
            });
          }
          discounts = [{ coupon: promo.stripeCouponId }];
          appliedPromoCodeId = promo.id;
        }
      }

      const isProduction = process.env.NODE_ENV === "production";
      const priceId =
        input.interval === "annual"
          ? isProduction
            ? process.env.STRIPE_ANNUAL_PRICE_ID!
            : process.env.STRIPE_ANNUAL_TEST_PRICE_ID!
          : isProduction
            ? process.env.STRIPE_MONTHLY_PRICE_ID!
            : process.env.STRIPE_MONTHLY_TEST_PRICE_ID!;

      const baseUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : process.env.APP_URL || "https://grammble.com";

      const session = await stripe.checkout.sessions.create({
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : { customer_email: user?.email ?? ctx.user.email }),
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        ...(discounts && { discounts }),
        success_url: `${baseUrl}/`,
        cancel_url: `${baseUrl}/`,
        metadata: {
          userId: ctx.user.id,
          ...(appliedPromoCodeId && { promoCodeId: appliedPromoCodeId }),
        },
      });

      return { url: session.url };
    }),

  redeemPromo: protectedProcedure
    .input(v.object({ code: v.pipe(v.string(), v.minLength(1)) }))
    .mutation(async ({ ctx, input }) => {
      const { prismaClient } = await import("~/utils/db/prisma");

      const code = input.code.toUpperCase().trim();

      const promo = await prismaClient.promoCode.findUnique({
        where: { code },
      });

      if (!promo || !promo.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid promo code.",
        });
      }

      if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This promo code has expired.",
        });
      }

      if (
        promo.maxRedemptions &&
        promo.currentRedemptions >= promo.maxRedemptions
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This promo code is no longer available.",
        });
      }

      // Check duplicate redemption
      const existing = await prismaClient.promoRedemption.findUnique({
        where: {
          userId_promoCodeId: {
            userId: ctx.user.id,
            promoCodeId: promo.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already used this code.",
        });
      }

      type UserUpdateData = Parameters<
        typeof prismaClient.user.update
      >[0]["data"];

      // Atomically claim a redemption slot, record it, and apply any premium
      // grant in one transaction. The guarded updateMany increments
      // currentRedemptions only while still under the cap, so concurrent
      // redemptions can't push past maxRedemptions (the pre-check above is just
      // a fast, friendly rejection, not the enforcement point). The unique
      // [userId, promoCodeId] constraint blocks a per-user double-redeem even
      // under a race, rolling back the increment with it.
      const claimRedemption = async (userData: UserUpdateData | null) => {
        try {
          await prismaClient.$transaction(async (tx) => {
            if (promo.maxRedemptions != null) {
              const claim = await tx.promoCode.updateMany({
                where: {
                  id: promo.id,
                  currentRedemptions: { lt: promo.maxRedemptions },
                },
                data: { currentRedemptions: { increment: 1 } },
              });
              if (claim.count === 0) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "This promo code is no longer available.",
                });
              }
            } else {
              await tx.promoCode.update({
                where: { id: promo.id },
                data: { currentRedemptions: { increment: 1 } },
              });
            }

            await tx.promoRedemption.create({
              data: { userId: ctx.user.id, promoCodeId: promo.id },
            });

            if (userData) {
              await tx.user.update({
                where: { id: ctx.user.id },
                data: userData,
              });
            }
          });
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          // Unique-constraint violation: a concurrent request already redeemed
          // this code for this user.
          if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code?: unknown }).code === "P2002"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You have already used this code.",
            });
          }
          throw err;
        }
      };

      if (promo.type === "LIFETIME_FREE") {
        await claimRedemption({ isPremium: true, premiumGranted: true });
        return { type: "LIFETIME_FREE" as const };
      }

      if (promo.type === "FREE_TRIAL") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + FREE_TRIAL_DAYS);
        await claimRedemption({ isPremium: true, premiumExpiresAt: expiresAt });
        return { type: "FREE_TRIAL" as const, expiresAt };
      }

      if (promo.type === "DISCOUNT") {
        await claimRedemption(null);
        return { type: "DISCOUNT" as const, code: promo.code };
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unknown promo type.",
      });
    }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const { stripe } = await import("~/utils/stripe/stripe");
    const { prismaClient } = await import("~/utils/db/prisma");

    const sub = await prismaClient.subscription.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!sub) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No subscription found.",
      });
    }

    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : process.env.APP_URL || "https://grammble.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${baseUrl}/`,
    });

    return { url: session.url };
  }),

  generateReferralCode: protectedProcedure.mutation(async ({ ctx }) => {
    const { prismaClient } = await import("~/utils/db/prisma");

    const user = await prismaClient.user.findUnique({
      where: { id: ctx.user.id },
      select: { premiumGranted: true, username: true },
    });

    if (!user?.premiumGranted) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only lifetime premium members can generate referral codes.",
      });
    }

    // Check if user already has a referral code
    const existing = await prismaClient.promoCode.findFirst({
      where: { creatorId: ctx.user.id },
    });

    if (existing) {
      return { code: existing.code, maxRedemptions: existing.maxRedemptions };
    }

    // Generate a code based on username
    const prefix = (user.username || "REF").toUpperCase().slice(0, 8);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${prefix}-${suffix}`;

    const promoCode = await prismaClient.promoCode.create({
      data: {
        code,
        type: "FREE_TRIAL",
        creatorId: ctx.user.id,
        maxRedemptions: REFERRAL_MAX_REDEMPTIONS,
      },
    });

    return { code: promoCode.code, maxRedemptions: promoCode.maxRedemptions };
  }),

  getReferralInfo: protectedProcedure.query(async ({ ctx }) => {
    const { prismaClient } = await import("~/utils/db/prisma");

    const promoCode = await prismaClient.promoCode.findFirst({
      where: { creatorId: ctx.user.id },
      select: {
        code: true,
        maxRedemptions: true,
        currentRedemptions: true,
        redemptions: {
          select: {
            redeemedAt: true,
            user: { select: { username: true, displayUsername: true } },
          },
          orderBy: { redeemedAt: "desc" },
        },
      },
    });

    if (!promoCode) return null;

    return promoCode;
  }),
});

export const appRouter = createTRPCRouter({
  game: gameRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = (ctx: TRPCContext) => appRouter.createCaller(ctx);
