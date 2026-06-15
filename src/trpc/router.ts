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
import type { LetterFeedback } from "~/utils/game/types";
import {
  MAX_GUESSES,
  GAME_MODES,
  GUESS_MIN_LENGTH_BY_MODE,
  GUESS_MAX_LENGTH_BY_MODE,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import { EMPTY_STATS, applyTerminalToStats, type Stats } from "~/utils/game/stats";
import { computePuzzleScore } from "~/utils/game/score";

const modeSchema = v.picklist(["SIX", "SEVEN", "EIGHT"] as const);

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
  prisma: typeof import("~/utils/db/prisma")["prismaClient"],
  userId: string,
  mode: GameMode,
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
    distribution: row.distribution.length === MAX_GUESSES
      ? row.distribution
      : EMPTY_STATS.distribution,
    lastPuzzleNumber: row.lastPuzzleNumber,
    totalScore: row.totalScore,
    bestScore: row.bestScore,
  };
}

async function persistTerminalStats(
  prisma: typeof import("~/utils/db/prisma")["prismaClient"],
  userId: string,
  mode: GameMode,
  outcome: "WON" | "LOST",
  guessCount: number,
  puzzleNumber: number,
  score: number,
): Promise<void> {
  const prev = await getOrCreateStats(prisma, userId, mode);
  const next = applyTerminalToStats(prev, outcome, guessCount, puzzleNumber, score);
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

async function buildDailyForMode(
  ctx: TRPCContext,
  date: string,
  mode: GameMode,
  puzzle: Awaited<ReturnType<typeof getDailyPuzzle>>,
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
    difficulty: difficultyOf(puzzle.gram.difficulty),
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

  getAllDaily: publicProcedure.query(async ({ ctx }) => {
    const date = getDateString();
    // Only fetch modes the user is entitled to: everyone gets 6-letter;
    // 7- and 8-letter are premium-only, so non-premium users never receive
    // their puzzle data.
    const allowedModes = GAME_MODES.filter(
      (mode) => mode === "SIX" || ctx.user?.isPremium,
    );
    const puzzles = await getAllDailyPuzzles(date);
    const result: Partial<Record<GameMode, DailyModeData>> = {};
    for (const mode of allowedModes) {
      const puzzle = puzzles.get(mode)!;
      result[mode] = await buildDailyForMode(ctx, date, mode, puzzle);
    }
    return result;
  }),

  getUserStats: protectedProcedure
    .input(v.object({ mode: modeSchema }))
    .query(async ({ ctx, input }) => {
      const { prismaClient } = await import("~/utils/db/prisma");
      return getOrCreateStats(prismaClient, ctx.user.id, input.mode);
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
          v.pipe(v.array(v.string()), v.maxLength(MAX_GUESSES)),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { mode } = input;
      assertModeAllowed(ctx, mode);
      const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
      const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];
      const guess = input.guess.trim().toUpperCase();

      if (guess.length < minLen || guess.length > maxLen) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Guess must be ${minLen}-${maxLen} letters.`,
        });
      }

      const guessSet = await getGuessSet(mode);
      if (!guessSet.has(guess)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Not a valid word.",
        });
      }

      const date = getDateString();
      const puzzle = await getDailyPuzzle(date, mode);
      const gram = puzzle.gram.letters;

      if (!guess.includes(gram)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Guess must contain the gram "${gram}".`,
        });
      }

      let existingGuesses: string[] = [];
      let existingFeedback: LetterFeedback[][] = [];
      let prismaClient: typeof import("~/utils/db/prisma")["prismaClient"] | null = null;

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
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Already guessed that word.",
            });
          }
          existingGuesses = session.guesses;
          existingFeedback = session.feedback as LetterFeedback[][];
        }
      }

      const feedback = computeFeedback(guess, puzzle.word, gram);

      const isWin =
        guess.length === puzzle.word.length &&
        feedback.every((f) => f === "correct" || f === "gramCorrect");
      const attemptNumber = existingGuesses.length + 1;
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
          const history = (input.history ?? [])
            .map((g) => g.trim().toUpperCase())
            .filter((g) => g.length > 0);
          fullGuesses = [...history, guess];
          fullFeedback = fullGuesses.map((g) =>
            computeFeedback(g, puzzle.word, gram),
          );
        }
        score = computePuzzleScore({
          guesses: fullGuesses,
          feedback: fullFeedback,
          won: status === "WON",
          wordLength: puzzle.word.length,
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
            completedAt:
              status !== "IN_PROGRESS" ? new Date() : undefined,
          },
          update: {
            guesses: [...existingGuesses, guess],
            feedback: [...existingFeedback, feedback],
            status,
            score: score ?? null,
            completedAt:
              status !== "IN_PROGRESS" ? new Date() : undefined,
          },
        });

        if ((status === "WON" || status === "LOST") && score !== undefined) {
          await persistTerminalStats(
            prismaClient,
            ctx.user.id,
            mode,
            status,
            attemptNumber,
            puzzle.number,
            score,
          );
        }
      }

      const result: {
        feedback: LetterFeedback[];
        status: string;
        attemptsRemaining: number;
        word?: string;
        score?: number;
      } = {
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
          v.maxLength(MAX_GUESSES),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.guesses.length === 0) {
        return { merged: false as const };
      }

      const { mode } = input;
      const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
      const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];

      const date = getDateString();
      const puzzle = await getDailyPuzzle(date, mode);
      const gram = puzzle.gram.letters;

      const guessSet = await getGuessSet(mode);
      const normalizedGuesses = input.guesses.map((g) =>
        g.trim().toUpperCase(),
      );

      for (const guess of normalizedGuesses) {
        if (guess.length < minLen || guess.length > maxLen) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Guess must be ${minLen}-${maxLen} letters.`,
          });
        }
        if (!guessSet.has(guess)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid guess: ${guess}`,
          });
        }
        if (!guess.includes(gram)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Guess must contain the gram "${gram}".`,
          });
        }
      }

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

      const feedback: LetterFeedback[][] = normalizedGuesses.map((g) =>
        computeFeedback(g, puzzle.word, gram),
      );

      let status: "IN_PROGRESS" | "WON" | "LOST" = "IN_PROGRESS";
      for (let i = 0; i < normalizedGuesses.length; i++) {
        const guess = normalizedGuesses[i];
        const fb = feedback[i];
        const isWin =
          guess.length === puzzle.word.length &&
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
              guesses: normalizedGuesses,
              feedback,
              won: status === "WON",
              wordLength: puzzle.word.length,
            })
          : null;

      await prismaClient.gameSession.create({
        data: {
          userId: ctx.user.id,
          puzzleId: puzzle.id,
          guesses: normalizedGuesses,
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
          score,
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
      if (input.promoCode) {
        const promo = await prismaClient.promoCode.findUnique({
          where: { code: input.promoCode.toUpperCase().trim() },
        });

        if (promo?.active && promo.type === "DISCOUNT" && promo.stripeCouponId) {
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
          discounts = [{ coupon: promo.stripeCouponId }];
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
        metadata: { userId: ctx.user.id },
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

      if (promo.type === "LIFETIME_FREE") {
        await prismaClient.$transaction([
          prismaClient.user.update({
            where: { id: ctx.user.id },
            data: { isPremium: true, premiumGranted: true },
          }),
          prismaClient.promoRedemption.create({
            data: { userId: ctx.user.id, promoCodeId: promo.id },
          }),
          prismaClient.promoCode.update({
            where: { id: promo.id },
            data: { currentRedemptions: { increment: 1 } },
          }),
        ]);

        return { type: "LIFETIME_FREE" as const };
      }

      if (promo.type === "FREE_TRIAL") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + FREE_TRIAL_DAYS);

        await prismaClient.$transaction([
          prismaClient.user.update({
            where: { id: ctx.user.id },
            data: { isPremium: true, premiumExpiresAt: expiresAt },
          }),
          prismaClient.promoRedemption.create({
            data: { userId: ctx.user.id, promoCodeId: promo.id },
          }),
          prismaClient.promoCode.update({
            where: { id: promo.id },
            data: { currentRedemptions: { increment: 1 } },
          }),
        ]);

        return { type: "FREE_TRIAL" as const, expiresAt };
      }

      if (promo.type === "DISCOUNT") {
        await prismaClient.$transaction([
          prismaClient.promoRedemption.create({
            data: { userId: ctx.user.id, promoCodeId: promo.id },
          }),
          prismaClient.promoCode.update({
            where: { id: promo.id },
            data: { currentRedemptions: { increment: 1 } },
          }),
        ]);

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
