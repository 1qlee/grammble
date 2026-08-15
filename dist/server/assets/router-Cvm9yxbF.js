import * as v from "valibot";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "./init-CNGCFNT_.js";
const PUZZLE_TIMEZONE = "America/Los_Angeles";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PUZZLE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
function getDateString() {
  return dateFormatter.format(/* @__PURE__ */ new Date());
}
async function getDailyPuzzle(date) {
  const { prismaClient } = await import("./prisma-CDBmz4-v.js");
  const puzzle = await prismaClient.puzzle.findUnique({
    where: { date },
    include: { gram: true }
  });
  if (!puzzle) {
    throw new Error(`No puzzle found for date ${date}`);
  }
  return puzzle;
}
let guessSet = null;
async function getGuessSet() {
  if (!guessSet) {
    const data = await import("./guess-list-D7gS1CyL.js");
    guessSet = new Set(data.default);
  }
  return guessSet;
}
function findAllOccurrences(haystack, needle) {
  const indices = [];
  if (needle.length === 0) return indices;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    indices.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return indices;
}
function computeFeedback(guess, hiddenWord, gram) {
  const g = guess.toUpperCase();
  const h = hiddenWord.toUpperCase();
  const gr = gram.toUpperCase();
  const feedback = new Array(g.length);
  const used = new Array(h.length).fill(false);
  const guessOccurrences = findAllOccurrences(g, gr);
  const hiddenOccurrences = findAllOccurrences(h, gr);
  if (guessOccurrences.length === 0 || hiddenOccurrences.length === 0) {
    throw new Error("Gram not present in both guess and hidden word");
  }
  const alignedIndex = guessOccurrences.find(
    (gi) => hiddenOccurrences.includes(gi)
  );
  const gramAligned = alignedIndex !== void 0;
  const guessGramIndex = gramAligned ? alignedIndex : guessOccurrences[0];
  const hiddenGramIndex = gramAligned ? alignedIndex : hiddenOccurrences[0];
  const gramEnd = guessGramIndex + gr.length;
  for (let i = guessGramIndex; i < gramEnd; i++) {
    feedback[i] = gramAligned ? "gramCorrect" : "gramMisplaced";
  }
  for (let j = hiddenGramIndex; j < hiddenGramIndex + gr.length; j++) {
    used[j] = true;
  }
  for (let i = 0; i < g.length; i++) {
    if (feedback[i] != null) continue;
    if (i < h.length && g[i] === h[i] && !used[i]) {
      feedback[i] = "correct";
      used[i] = true;
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (feedback[i] != null) continue;
    const matchIndex = h.split("").findIndex((ch, j) => ch === g[i] && !used[j]);
    if (matchIndex !== -1) {
      feedback[i] = "misplaced";
      used[matchIndex] = true;
    } else {
      feedback[i] = "absent";
    }
  }
  return feedback;
}
const MAX_GUESSES = 6;
const WORD_LENGTH = 6;
const MIN_GUESS_LENGTH = 4;
const TILE_POP_PEAK_DURATION_MS = 200;
const TILE_POP_PEAK_SCALE = 1.1;
const TILE_POP_SPRING_BOUNCE = 0.7;
const EMPTY_STATS = {
  played: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: Array(MAX_GUESSES).fill(0),
  lastPuzzleNumber: null
};
function applyTerminalToStats(prev, outcome, guessCount, puzzleNumber) {
  if (prev.lastPuzzleNumber === puzzleNumber) return prev;
  const won = outcome === "WON";
  const continued = prev.lastPuzzleNumber === puzzleNumber - 1;
  const currentStreak = won ? continued ? prev.currentStreak + 1 : 1 : 0;
  const maxStreak = Math.max(prev.maxStreak, currentStreak);
  const distribution = [...prev.distribution];
  if (won && guessCount >= 1 && guessCount <= MAX_GUESSES) {
    distribution[guessCount - 1] += 1;
  }
  return {
    played: prev.played + 1,
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    currentStreak,
    maxStreak,
    distribution,
    lastPuzzleNumber: puzzleNumber
  };
}
async function getOrCreateStats(prisma, userId) {
  const row = await prisma.userStats.findUnique({ where: { userId } });
  if (!row) return EMPTY_STATS;
  return {
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    currentStreak: row.currentStreak,
    maxStreak: row.maxStreak,
    distribution: row.distribution.length === MAX_GUESSES ? row.distribution : EMPTY_STATS.distribution,
    lastPuzzleNumber: row.lastPuzzleNumber
  };
}
async function persistTerminalStats(prisma, userId, outcome, guessCount, puzzleNumber) {
  const prev = await getOrCreateStats(prisma, userId);
  const next = applyTerminalToStats(prev, outcome, guessCount, puzzleNumber);
  if (next === prev) return;
  await prisma.userStats.upsert({
    where: { userId },
    create: { userId, ...next },
    update: {
      played: next.played,
      wins: next.wins,
      losses: next.losses,
      currentStreak: next.currentStreak,
      maxStreak: next.maxStreak,
      distribution: next.distribution,
      lastPuzzleNumber: next.lastPuzzleNumber
    }
  });
}
const gameRouter = createTRPCRouter({
  getDaily: publicProcedure.query(async ({ ctx }) => {
    const date = getDateString();
    const puzzle = await getDailyPuzzle(date);
    let gameState = null;
    if (ctx.user) {
      const { prismaClient } = await import("./prisma-CDBmz4-v.js");
      const session = await prismaClient.gameSession.findUnique({
        where: {
          userId_puzzleId: {
            userId: ctx.user.id,
            puzzleId: puzzle.id
          }
        }
      });
      if (session) {
        gameState = {
          guesses: session.guesses,
          feedback: session.feedback,
          status: session.status,
          attemptsRemaining: MAX_GUESSES - session.guesses.length,
          word: session.status === "IN_PROGRESS" ? null : puzzle.word
        };
      }
    }
    const difficulty = puzzle.gram.difficulty === "EASY" ? "easy" : puzzle.gram.difficulty === "HARD" ? "hard" : "med";
    let stats = EMPTY_STATS;
    if (ctx.user) {
      const { prismaClient } = await import("./prisma-CDBmz4-v.js");
      stats = await getOrCreateStats(prismaClient, ctx.user.id);
    }
    return {
      date,
      gram: puzzle.gram.letters,
      puzzleNumber: puzzle.number,
      difficulty,
      gameState,
      stats
    };
  }),
  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    return getOrCreateStats(prismaClient, ctx.user.id);
  }),
  submitGuess: publicProcedure.input(v.object({ guess: v.pipe(v.string(), v.minLength(4), v.maxLength(6)) })).mutation(async ({ ctx, input }) => {
    const guess = input.guess.trim().toUpperCase();
    if (guess.length < 4 || guess.length > 6) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Guess must be 4-6 letters."
      });
    }
    const guessSet2 = await getGuessSet();
    if (!guessSet2.has(guess)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Not a valid word."
      });
    }
    const date = getDateString();
    const puzzle = await getDailyPuzzle(date);
    const gram = puzzle.gram.letters;
    if (!guess.includes(gram)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Guess must contain the gram "${gram}".`
      });
    }
    let existingGuesses = [];
    let existingFeedback = [];
    let prismaClient = null;
    if (ctx.user) {
      prismaClient = (await import("./prisma-CDBmz4-v.js")).prismaClient;
      const session = await prismaClient.gameSession.findUnique({
        where: {
          userId_puzzleId: {
            userId: ctx.user.id,
            puzzleId: puzzle.id
          }
        }
      });
      if (session) {
        if (session.status !== "IN_PROGRESS") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Game already completed."
          });
        }
        if (session.guesses.length >= MAX_GUESSES) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No attempts remaining."
          });
        }
        if (session.guesses.includes(guess)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Already guessed that word."
          });
        }
        existingGuesses = session.guesses;
        existingFeedback = session.feedback;
      }
    }
    const feedback = computeFeedback(guess, puzzle.word, gram);
    const isWin = guess.length === puzzle.word.length && feedback.every((f) => f === "correct" || f === "gramCorrect");
    const attemptNumber = existingGuesses.length + 1;
    const isLoss = !isWin && attemptNumber >= MAX_GUESSES;
    const status = isWin ? "WON" : isLoss ? "LOST" : "IN_PROGRESS";
    if (ctx.user && prismaClient) {
      await prismaClient.gameSession.upsert({
        where: {
          userId_puzzleId: {
            userId: ctx.user.id,
            puzzleId: puzzle.id
          }
        },
        create: {
          userId: ctx.user.id,
          puzzleId: puzzle.id,
          guesses: [guess],
          feedback: [feedback],
          status,
          completedAt: status !== "IN_PROGRESS" ? /* @__PURE__ */ new Date() : void 0
        },
        update: {
          guesses: [...existingGuesses, guess],
          feedback: [...existingFeedback, feedback],
          status,
          completedAt: status !== "IN_PROGRESS" ? /* @__PURE__ */ new Date() : void 0
        }
      });
      if (status === "WON" || status === "LOST") {
        await persistTerminalStats(
          prismaClient,
          ctx.user.id,
          status,
          attemptNumber,
          puzzle.number
        );
      }
    }
    const result = {
      feedback,
      status,
      attemptsRemaining: MAX_GUESSES - attemptNumber
    };
    if (status === "WON" || status === "LOST") {
      result.word = puzzle.word;
    }
    return result;
  }),
  syncAnonymousSession: protectedProcedure.input(
    v.object({
      guesses: v.pipe(
        v.array(v.pipe(v.string(), v.minLength(4), v.maxLength(6))),
        v.maxLength(MAX_GUESSES)
      )
    })
  ).mutation(async ({ ctx, input }) => {
    if (input.guesses.length === 0) {
      return { merged: false };
    }
    const date = getDateString();
    const puzzle = await getDailyPuzzle(date);
    const gram = puzzle.gram.letters;
    const guessSet2 = await getGuessSet();
    const normalizedGuesses = input.guesses.map(
      (g) => g.trim().toUpperCase()
    );
    for (const guess of normalizedGuesses) {
      if (guess.length < 4 || guess.length > 6) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Guess must be 4-6 letters."
        });
      }
      if (!guessSet2.has(guess)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid guess: ${guess}`
        });
      }
      if (!guess.includes(gram)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Guess must contain the gram "${gram}".`
        });
      }
    }
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const existing = await prismaClient.gameSession.findUnique({
      where: {
        userId_puzzleId: {
          userId: ctx.user.id,
          puzzleId: puzzle.id
        }
      }
    });
    if (existing) {
      return { merged: false };
    }
    const feedback = normalizedGuesses.map(
      (g) => computeFeedback(g, puzzle.word, gram)
    );
    let status = "IN_PROGRESS";
    for (let i = 0; i < normalizedGuesses.length; i++) {
      const guess = normalizedGuesses[i];
      const fb = feedback[i];
      const isWin = guess.length === puzzle.word.length && fb.every((f) => f === "correct" || f === "gramCorrect");
      if (isWin) {
        status = "WON";
        break;
      }
      if (i + 1 >= MAX_GUESSES) {
        status = "LOST";
      }
    }
    await prismaClient.gameSession.create({
      data: {
        userId: ctx.user.id,
        puzzleId: puzzle.id,
        guesses: normalizedGuesses,
        feedback,
        status,
        completedAt: status !== "IN_PROGRESS" ? /* @__PURE__ */ new Date() : void 0
      }
    });
    if (status === "WON" || status === "LOST") {
      await persistTerminalStats(
        prismaClient,
        ctx.user.id,
        status,
        normalizedGuesses.length,
        puzzle.number
      );
    }
    return { merged: true };
  })
});
const REFERRAL_MAX_REDEMPTIONS = 5;
const FREE_TRIAL_DAYS = 90;
const billingRouter = createTRPCRouter({
  getPrices: publicProcedure.query(async () => {
    const { stripe } = await import("./stripe-CqQ-SJqY.js");
    const isProduction = process.env.NODE_ENV === "production";
    const monthlyPriceId = isProduction ? process.env.STRIPE_MONTHLY_PRICE_ID : process.env.STRIPE_MONTHLY_TEST_PRICE_ID;
    const annualPriceId = isProduction ? process.env.STRIPE_ANNUAL_PRICE_ID : process.env.STRIPE_ANNUAL_TEST_PRICE_ID;
    const [monthly, annual] = await Promise.all([
      stripe.prices.retrieve(monthlyPriceId),
      stripe.prices.retrieve(annualPriceId)
    ]);
    return {
      monthly: { amount: monthly.unit_amount ?? 0, currency: monthly.currency },
      annual: { amount: annual.unit_amount ?? 0, currency: annual.currency }
    };
  }),
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
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
            cancelAtPeriodEnd: true
          }
        }
      }
    });
    return {
      isPremium: user?.isPremium ?? false,
      premiumGranted: user?.premiumGranted ?? false,
      premiumExpiresAt: user?.premiumExpiresAt ?? null,
      subscription: user?.subscription ?? null
    };
  }),
  createCheckout: protectedProcedure.input(
    v.object({
      interval: v.picklist(["monthly", "annual"]),
      promoCode: v.optional(v.string())
    })
  ).mutation(async ({ ctx, input }) => {
    const { stripe } = await import("./stripe-CqQ-SJqY.js");
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const user = await prismaClient.user.findUnique({
      where: { id: ctx.user.id },
      select: { isPremium: true, email: true, subscription: true }
    });
    if (user?.isPremium) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You already have premium."
      });
    }
    const existingCustomerId = user?.subscription?.stripeCustomerId;
    let discounts;
    if (input.promoCode) {
      const promo = await prismaClient.promoCode.findUnique({
        where: { code: input.promoCode.toUpperCase().trim() }
      });
      if (promo?.active && promo.type === "DISCOUNT" && promo.stripeCouponId) {
        if (promo.expiresAt && promo.expiresAt < /* @__PURE__ */ new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This promo code has expired."
          });
        }
        if (promo.maxRedemptions && promo.currentRedemptions >= promo.maxRedemptions) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This promo code has reached its limit."
          });
        }
        discounts = [{ coupon: promo.stripeCouponId }];
      }
    }
    const isProduction = process.env.NODE_ENV === "production";
    const priceId = input.interval === "annual" ? isProduction ? process.env.STRIPE_ANNUAL_PRICE_ID : process.env.STRIPE_ANNUAL_TEST_PRICE_ID : isProduction ? process.env.STRIPE_MONTHLY_PRICE_ID : process.env.STRIPE_MONTHLY_TEST_PRICE_ID;
    const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.APP_URL || "https://grammble.com";
    const session = await stripe.checkout.sessions.create({
      ...existingCustomerId ? { customer: existingCustomerId } : { customer_email: user?.email ?? ctx.user.email },
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...discounts && { discounts },
      success_url: `${baseUrl}/`,
      cancel_url: `${baseUrl}/`,
      metadata: { userId: ctx.user.id }
    });
    return { url: session.url };
  }),
  redeemPromo: protectedProcedure.input(v.object({ code: v.pipe(v.string(), v.minLength(1)) })).mutation(async ({ ctx, input }) => {
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const code = input.code.toUpperCase().trim();
    const promo = await prismaClient.promoCode.findUnique({
      where: { code }
    });
    if (!promo || !promo.active) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid promo code."
      });
    }
    if (promo.expiresAt && promo.expiresAt < /* @__PURE__ */ new Date()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This promo code has expired."
      });
    }
    if (promo.maxRedemptions && promo.currentRedemptions >= promo.maxRedemptions) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This promo code is no longer available."
      });
    }
    const existing = await prismaClient.promoRedemption.findUnique({
      where: {
        userId_promoCodeId: {
          userId: ctx.user.id,
          promoCodeId: promo.id
        }
      }
    });
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You have already used this code."
      });
    }
    if (promo.type === "LIFETIME_FREE") {
      await prismaClient.$transaction([
        prismaClient.user.update({
          where: { id: ctx.user.id },
          data: { isPremium: true, premiumGranted: true }
        }),
        prismaClient.promoRedemption.create({
          data: { userId: ctx.user.id, promoCodeId: promo.id }
        }),
        prismaClient.promoCode.update({
          where: { id: promo.id },
          data: { currentRedemptions: { increment: 1 } }
        })
      ]);
      return { type: "LIFETIME_FREE" };
    }
    if (promo.type === "FREE_TRIAL") {
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setDate(expiresAt.getDate() + FREE_TRIAL_DAYS);
      await prismaClient.$transaction([
        prismaClient.user.update({
          where: { id: ctx.user.id },
          data: { isPremium: true, premiumExpiresAt: expiresAt }
        }),
        prismaClient.promoRedemption.create({
          data: { userId: ctx.user.id, promoCodeId: promo.id }
        }),
        prismaClient.promoCode.update({
          where: { id: promo.id },
          data: { currentRedemptions: { increment: 1 } }
        })
      ]);
      return { type: "FREE_TRIAL", expiresAt };
    }
    if (promo.type === "DISCOUNT") {
      await prismaClient.$transaction([
        prismaClient.promoRedemption.create({
          data: { userId: ctx.user.id, promoCodeId: promo.id }
        }),
        prismaClient.promoCode.update({
          where: { id: promo.id },
          data: { currentRedemptions: { increment: 1 } }
        })
      ]);
      return { type: "DISCOUNT", code: promo.code };
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unknown promo type."
    });
  }),
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const { stripe } = await import("./stripe-CqQ-SJqY.js");
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const sub = await prismaClient.subscription.findUnique({
      where: { userId: ctx.user.id }
    });
    if (!sub) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No subscription found."
      });
    }
    const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.APP_URL || "https://grammble.com";
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${baseUrl}/`
    });
    return { url: session.url };
  }),
  generateReferralCode: protectedProcedure.mutation(async ({ ctx }) => {
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const user = await prismaClient.user.findUnique({
      where: { id: ctx.user.id },
      select: { premiumGranted: true, username: true }
    });
    if (!user?.premiumGranted) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only lifetime premium members can generate referral codes."
      });
    }
    const existing = await prismaClient.promoCode.findFirst({
      where: { creatorId: ctx.user.id }
    });
    if (existing) {
      return { code: existing.code, maxRedemptions: existing.maxRedemptions };
    }
    const prefix = (user.username || "REF").toUpperCase().slice(0, 8);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${prefix}-${suffix}`;
    const promoCode = await prismaClient.promoCode.create({
      data: {
        code,
        type: "FREE_TRIAL",
        creatorId: ctx.user.id,
        maxRedemptions: REFERRAL_MAX_REDEMPTIONS
      }
    });
    return { code: promoCode.code, maxRedemptions: promoCode.maxRedemptions };
  }),
  getReferralInfo: protectedProcedure.query(async ({ ctx }) => {
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const promoCode = await prismaClient.promoCode.findFirst({
      where: { creatorId: ctx.user.id },
      select: {
        code: true,
        maxRedemptions: true,
        currentRedemptions: true,
        redemptions: {
          select: {
            redeemedAt: true,
            user: { select: { username: true, displayUsername: true } }
          },
          orderBy: { redeemedAt: "desc" }
        }
      }
    });
    if (!promoCode) return null;
    return promoCode;
  })
});
const appRouter = createTRPCRouter({
  game: gameRouter,
  billing: billingRouter
});
const createCaller = (ctx) => appRouter.createCaller(ctx);
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  appRouter,
  createCaller
}, Symbol.toStringTag, { value: "Module" }));
export {
  EMPTY_STATS as E,
  MAX_GUESSES as M,
  TILE_POP_PEAK_DURATION_MS as T,
  WORD_LENGTH as W,
  appRouter as a,
  applyTerminalToStats as b,
  TILE_POP_PEAK_SCALE as c,
  TILE_POP_SPRING_BOUNCE as d,
  MIN_GUESS_LENGTH as e,
  router as r
};
