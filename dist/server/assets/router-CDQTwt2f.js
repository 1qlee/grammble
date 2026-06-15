import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useRouter, useMatch, rootRouteId, ErrorComponent, Link, useNavigate, useMatchRoute, createRootRoute, Outlet, HeadContent, Scripts, createFileRoute, lazyRouteComponent, redirect, createRouter } from "@tanstack/react-router";
import * as React from "react";
import { useState, useRef, useEffect, createContext, use, useCallback, useSyncExternalStore } from "react";
import { animate } from "animejs";
import { Dialog as Dialog$1, DialogPanel, DialogTitle, Description, Switch, Field, RadioGroup, Radio, TabGroup, TabList, Tab, TabPanels, TabPanel, Transition } from "@headlessui/react";
import { X, LoaderCircle, Check, Copy } from "lucide-react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { A as Alert, I as Input, B as Button, a as Badge, L as Label } from "./Label-wLCwUdwb.js";
import { c as createSsrRpc, S as SignupSchema, s as sendVerificationEmail } from "./email-CMSc4YY_.js";
import * as v from "valibot";
import { safeParse } from "valibot";
import { a as authMiddleware } from "./auth-middleware-D9HYqFnh.js";
import { c as createServerFn } from "../server.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import clsx from "clsx";
import { g as getBaseURL, c as createFetch, d as defu, a as auth } from "./auth-CoiYOFBV.js";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { a as appRouter } from "./router-Cvm9yxbF.js";
import { createTRPCContext } from "./init-CNGCFNT_.js";
import { prismaClient } from "./prisma-CDBmz4-v.js";
const appCss = "/assets/app-n_7VTXem.css";
function DefaultCatchBoundary({ error }) {
  const router2 = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId
  });
  console.error(error);
  return /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6", children: [
    /* @__PURE__ */ jsx(ErrorComponent, { error }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center flex-wrap", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            router2.invalidate();
          },
          className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
          children: "Try Again"
        }
      ),
      isRoot ? /* @__PURE__ */ jsx(
        Link,
        {
          to: "/",
          className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
          children: "Home"
        }
      ) : /* @__PURE__ */ jsx(
        Link,
        {
          to: "/",
          className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
          onClick: (e) => {
            e.preventDefault();
            window.history.back();
          },
          children: "Go Back"
        }
      )
    ] })
  ] });
}
function Dialog({ children, buttonText, title, description, onOpen, onClose, isOpen: isOpenProp, setIsOpen: setIsOpenProp }) {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isMounted = useRef(false);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  const isControlled = isOpenProp !== void 0;
  const isOpen = isControlled ? isOpenProp : isOpenInternal;
  const setIsOpen = isControlled ? setIsOpenProp ?? (() => {
  }) : setIsOpenInternal;
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (isOpen) {
      onOpenRef.current?.();
    } else {
      onCloseRef.current?.();
    }
  }, [isOpen]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    !isControlled && /* @__PURE__ */ jsx("button", { className: "p-1 cursor-pointer select-none", onClick: () => setIsOpen(true), children: buttonText }),
    /* @__PURE__ */ jsx(
      Dialog$1,
      {
        open: isOpen,
        onClose: () => setIsOpen(false),
        transition: true,
        className: "fixed inset-0 flex w-screen items-end justify-center sm:items-center bg-black/30 sm:p-4 transition duration-200 ease-out data-closed:opacity-0 z-50",
        children: /* @__PURE__ */ jsxs(DialogPanel, { transition: true, className: "relative w-full sm:max-w-sm max-h-[90vh] overflow-y-auto bg-default-shadow rounded-lg transition duration-200 ease-out data-closed:translate-y-full sm:data-closed:translate-y-0", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setIsOpen(false),
              "aria-label": "Close dialog",
              className: "absolute top-3 right-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer z-10",
              children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" })
            }
          ),
          title && /* @__PURE__ */ jsx("div", { className: "mb-4 pr-8", children: /* @__PURE__ */ jsx(DialogTitle, { className: "text-lg font-bold", children: title }) }),
          description && /* @__PURE__ */ jsx(Description, { children: description }),
          children
        ] })
      }
    )
  ] });
}
const initialState = {
  date: "",
  gram: "",
  guesses: [],
  feedback: [],
  currentGuessIndex: 0,
  status: "IN_PROGRESS",
  revealedWord: null,
  editing: { toggled: false, key: 0 },
  isPaused: false,
  loading: false,
  toast: null,
  skipGramAnimation: false
};
const useGameStore = create()(
  persist(
    (set) => ({
      ...initialState,
      appendChar: (char) => set((state) => {
        const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
        if (currentGuess.length >= 6) return state;
        const newGuesses = [...state.guesses];
        newGuesses[state.currentGuessIndex] = currentGuess + char;
        return { guesses: newGuesses };
      }),
      backspace: () => set((state) => {
        const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
        const newGuesses = [...state.guesses];
        newGuesses[state.currentGuessIndex] = currentGuess.slice(
          0,
          -1
        );
        return { guesses: newGuesses };
      }),
      clearGuess: () => set((state) => {
        const newGuesses = [...state.guesses];
        newGuesses[state.currentGuessIndex] = "";
        return { guesses: newGuesses };
      }),
      setGuess: (value) => set((state) => {
        const newGuesses = [...state.guesses];
        newGuesses[state.currentGuessIndex] = value.slice(0, 6);
        return { guesses: newGuesses };
      }),
      setCharAt: (index, char) => set((state) => {
        const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
        if (index < 0 || index >= currentGuess.length) return state;
        const newGuess = currentGuess.slice(0, index) + char + currentGuess.slice(index + 1);
        const newGuesses = [...state.guesses];
        newGuesses[state.currentGuessIndex] = newGuess;
        return { guesses: newGuesses };
      }),
      removeCharAt: (index) => set((state) => {
        const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
        if (index < 0 || index >= currentGuess.length) return state;
        const newGuess = currentGuess.slice(0, index) + currentGuess.slice(index + 1);
        const newGuesses = [...state.guesses];
        newGuesses[state.currentGuessIndex] = newGuess;
        return { guesses: newGuesses };
      }),
      submitGuess: (feedback, status, word) => set((state) => ({
        feedback: [...state.feedback, feedback],
        status,
        currentGuessIndex: state.currentGuessIndex + 1,
        revealedWord: word ?? state.revealedWord
      })),
      setDailyPuzzle: (date, gram) => set((state) => {
        if (state.date !== date) {
          return {
            ...initialState,
            date,
            gram
          };
        }
        return { date, gram };
      }),
      resetSession: () => set({
        guesses: [],
        feedback: [],
        currentGuessIndex: 0,
        status: "IN_PROGRESS",
        revealedWord: null,
        editing: { toggled: false, key: 0 }
      }),
      hydrateSession: (data) => set({
        guesses: data.guesses,
        feedback: data.feedback,
        status: data.status,
        currentGuessIndex: data.currentGuessIndex,
        revealedWord: data.revealedWord ?? null
      }),
      pauseGame: () => set({ isPaused: true }),
      resumeGame: () => set({ isPaused: false }),
      setLoading: (loading) => set({ loading }),
      setToast: (toast) => set({ toast }),
      setSkipGramAnimation: (value) => set({ skipGramAnimation: value }),
      editKey: (key, toggled) => set((state) => ({
        editing: { toggled: toggled ?? !state.editing.toggled, key }
      }))
    }),
    {
      name: "grammble-game",
      skipHydration: true,
      partialize: (state) => ({
        date: state.date,
        gram: state.gram,
        guesses: state.guesses,
        feedback: state.feedback,
        currentGuessIndex: state.currentGuessIndex,
        status: state.status,
        revealedWord: state.revealedWord
      })
    }
  )
);
function PromoCodeSection() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const handleRedeem = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/trpc/billing.redeemPromo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { code: code.trim() } })
      });
      const data = await res.json();
      if (data?.error) {
        const message = data.error?.json?.message || data.error?.message || "Invalid promo code.";
        setResult({ type: "error", message });
      } else {
        const promoType = data?.result?.data?.json?.type;
        if (promoType === "LIFETIME_FREE") {
          setResult({
            type: "success",
            message: "Lifetime premium activated! Refresh to see changes."
          });
        } else if (promoType === "FREE_TRIAL") {
          setResult({
            type: "success",
            message: "Free trial activated! You have 3 months of premium access."
          });
        } else if (promoType === "DISCOUNT") {
          setResult({
            type: "success",
            message: "Discount applied! Subscribe below to use it."
          });
        }
        setCode("");
      }
    } catch {
      setResult({ type: "error", message: "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsxs("section", { className: "bg-accent p-4 rounded-lg", children: [
    /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold mb-2", children: "Promo Code" }),
    result && /* @__PURE__ */ jsx(
      Alert,
      {
        type: result.type === "success" ? "success" : "error",
        className: "mb-3",
        children: result.message
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-end", children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          type: "text",
          placeholder: "Enter code",
          value: code,
          onChange: (e) => setCode(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") handleRedeem();
          },
          onFocus: () => {
            if (result?.type === "error") setResult(null);
          },
          disabled: loading,
          className: "flex-1"
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          onClick: handleRedeem,
          "aria-disabled": loading || !code.trim(),
          children: loading ? /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin w-4 h-4" }) : "Redeem"
        }
      )
    ] })
  ] });
}
function ReferralSection({
  referral
}) {
  const [generating, setGenerating] = useState(false);
  const [referralCode, setReferralCode] = useState(referral?.code ?? null);
  const [maxRedemptions, setMaxRedemptions] = useState(
    referral?.maxRedemptions ?? null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/trpc/billing.generateReferralCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: {} })
      });
      const data = await res.json();
      if (data?.error) {
        setError(
          data.error?.json?.message || "Failed to generate referral code."
        );
      } else {
        const result = data?.result?.data?.json;
        setReferralCode(result?.code ?? null);
        setMaxRedemptions(result?.maxRedemptions ?? null);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };
  const handleCopy = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return /* @__PURE__ */ jsxs("section", { className: "bg-accent p-4 rounded-lg", children: [
    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: "Referral Code" }),
    /* @__PURE__ */ jsx("p", { className: "text-xs text-accent mb-2", children: "Share your referral code with friends to give them 3 months of free premium access." }),
    error && /* @__PURE__ */ jsx(Alert, { type: "error", className: "mb-3", children: error }),
    referralCode ? /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center gap-2", children: [
      /* @__PURE__ */ jsxs(
        Button,
        {
          onClick: handleCopy,
          className: "flex items-center gap-2",
          title: "Copy code",
          children: [
            /* @__PURE__ */ jsx("code", { className: "text-sm font-mono", children: referralCode }),
            copied ? /* @__PURE__ */ jsx(Check, { className: "w-4 h-4 text-green-500" }) : /* @__PURE__ */ jsx(Copy, { className: "w-4 h-4 opacity-50" })
          ]
        }
      ),
      maxRedemptions && /* @__PURE__ */ jsxs(Badge, { className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 h-4", children: [
        maxRedemptions,
        " uses left"
      ] })
    ] }) : /* @__PURE__ */ jsx(Button, { onClick: handleGenerate, "aria-disabled": generating, children: generating ? /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin w-4 h-4" }) : "Generate Referral Code" })
  ] });
}
const postThemeValidator = v.union([v.literal("light"), v.literal("dark")]);
const storageKey = "_preferred-theme";
const optionalUserIdValidator = v.optional(v.nullable(v.string()));
const getThemeServerFn_createServerFn_handler = createSsrRpc("5881fddf03040cfe3287810f620c995dfe8ab8da53b48634f0eaf1cb7810ee29");
createServerFn().inputValidator(optionalUserIdValidator).handler(getThemeServerFn_createServerFn_handler, async ({
  data: userId
}) => {
  const {
    getCookie,
    setCookie
  } = await import("./server-Bkh0Mepp.js");
  if (userId) {
    try {
      const {
        prismaClient: prismaClient2
      } = await import("./prisma-CDBmz4-v.js");
      const settings = await prismaClient2.settings.findUnique({
        where: {
          userId
        },
        select: {
          theme: true
        }
      });
      if (settings?.theme) {
        const themeFromDb = settings.theme === "dark" ? "dark" : "light";
        setCookie(storageKey, themeFromDb);
        return themeFromDb;
      }
    } catch (error) {
      console.error(`Failed to load theme from database for user ${userId}:`, error);
    }
  }
  return getCookie(storageKey) || "light";
});
const setThemeServerFn_createServerFn_handler = createSsrRpc("71df1c81de1627f92aad64454efb0cbee53b33c45818d2ce8fd4e7ad46e6b1c9");
const setThemeServerFn = createServerFn({
  method: "POST"
}).inputValidator(postThemeValidator).middleware([authMiddleware]).handler(setThemeServerFn_createServerFn_handler, async ({
  data,
  context
}) => {
  const {
    setCookie
  } = await import("./server-Bkh0Mepp.js");
  setCookie(storageKey, data);
  if (context?.user?.id) {
    try {
      const {
        prismaClient: prismaClient2
      } = await import("./prisma-CDBmz4-v.js");
      await prismaClient2.settings.upsert({
        where: {
          userId: context.user.id
        },
        create: {
          userId: context.user.id,
          theme: data === "dark" ? "dark" : "light"
        },
        update: {
          theme: data === "dark" ? "dark" : "light"
        }
      });
    } catch (error) {
      console.error(`Failed to update theme in database for user ${context.user.id}:`, error);
    }
  }
});
const ThemeContext = createContext(null);
function ThemeProvider({ children, theme }) {
  const router2 = useRouter();
  function setTheme(val) {
    if (typeof document === "undefined") return;
    const apply = () => document.documentElement.setAttribute("data-theme", val);
    if ("startViewTransition" in document) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
    setThemeServerFn({ data: val }).then(() => router2.invalidate());
  }
  return /* @__PURE__ */ jsx(ThemeContext, { value: { theme, setTheme }, children });
}
function useTheme() {
  const val = use(ThemeContext);
  if (!val) throw new Error("useTheme called outside of ThemeProvider!");
  return val;
}
function Toggle({ checked, onChange, "aria-label": ariaLabel, className }) {
  return /* @__PURE__ */ jsx(
    Switch,
    {
      checked,
      onChange,
      "aria-label": ariaLabel,
      className: `group switch-track ${className ?? ""}`,
      children: /* @__PURE__ */ jsx("span", { className: "switch-thumb" })
    }
  );
}
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const newTheme = theme === "light" ? "dark" : "light";
  return /* @__PURE__ */ jsx(
    Toggle,
    {
      checked: theme === "dark",
      onChange: () => setTheme(newTheme),
      "aria-label": `Switch to ${newTheme} mode`
    }
  );
}
function SettingField({ label, description, control }) {
  return /* @__PURE__ */ jsxs(Field, { className: "bg-accent p-4 rounded-lg w-full flex justify-between items-center gap-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
      /* @__PURE__ */ jsx(Label, { className: "text-sm font-medium", children: label }),
      description && /* @__PURE__ */ jsx(Description, { className: "text-xs text-accent", children: description })
    ] }),
    control
  ] });
}
function SettingsPanel() {
  const [confirmGuess, setConfirmGuess] = useState(false);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsx(SettingField, { label: "Dark Mode", control: /* @__PURE__ */ jsx(ThemeToggle, {}) }),
    /* @__PURE__ */ jsx(
      SettingField,
      {
        label: "Confirm All Guesses",
        description: "Requires another press on the enter key to submit your guess.",
        control: /* @__PURE__ */ jsx(
          Toggle,
          {
            checked: confirmGuess,
            onChange: setConfirmGuess,
            "aria-label": "Toggle confirm guess"
          }
        )
      }
    )
  ] });
}
const PREMIUM_BENEFITS = [
  "Play past puzzles in the archive",
  "Access 7 and 8 letter game modes",
  "Participate in the leaderboards",
  "Cancel any time"
];
const planCardCls = "group flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors data-checked:border-yellow-300 data-checked:ring-1 data-checked:ring-yellow-300 focus:outline-none";
function PlanHighlightCard({
  interval,
  onIntervalChange,
  annualPerMonth,
  annualTotal,
  monthlyPrice,
  user,
  checkoutLoading,
  onCheckout,
  onClose
}) {
  const isAnnual = interval === "annual";
  const formattedAnnualTotal = annualTotal?.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") ?? null;
  const ctaTotal = isAnnual ? formattedAnnualTotal : monthlyPrice;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold", children: "Go Premium" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-accent", children: "Pick a plan to access additional features." })
    ] }),
    /* @__PURE__ */ jsxs(RadioGroup, { value: interval, onChange: onIntervalChange, className: "space-y-3", children: [
      /* @__PURE__ */ jsxs(Radio, { value: "annual", className: planCardCls, children: [
        /* @__PURE__ */ jsx("span", { className: "flex w-5 h-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 group-data-checked:border-yellow-300", children: /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-yellow-300 opacity-0 group-data-checked:opacity-100" }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "font-bold", children: "Annual" }),
            /* @__PURE__ */ jsx(Badge, { className: "bg-yellow-300 text-zinc-900 uppercase text-xxs", children: "Best Value" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-accent mt-0.5", children: formattedAnnualTotal ? `${formattedAnnualTotal} billed yearly.` : "Billed yearly." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "text-right shrink-0", children: [
          /* @__PURE__ */ jsx("div", { className: "text-2xl font-bold price-gold leading-none", children: annualPerMonth ?? "—" }),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-accent mt-1", children: [
            monthlyPrice && /* @__PURE__ */ jsx("span", { className: "line-through mr-1", children: monthlyPrice }),
            "per month"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Radio, { value: "monthly", className: planCardCls, children: [
        /* @__PURE__ */ jsx("span", { className: "flex w-5 h-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 group-data-checked:border-yellow-300", children: /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-yellow-300 opacity-0 group-data-checked:opacity-100" }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "font-bold", children: "Monthly" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-accent mt-0.5", children: "Cancel any time." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "text-right shrink-0", children: [
          /* @__PURE__ */ jsx("div", { className: "text-2xl font-bold leading-none", children: monthlyPrice ?? "—" }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-accent mt-1", children: "per month" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "my-6", children: user ? /* @__PURE__ */ jsx(Button, { onClick: onCheckout, "aria-disabled": checkoutLoading, variant: "gold", className: "w-full", children: checkoutLoading ? /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin w-4 h-4" }) : /* @__PURE__ */ jsxs("span", { children: [
      "Start Premium",
      ctaTotal ? ` · ${ctaTotal}` : ""
    ] }) }) : /* @__PURE__ */ jsx(Link, { to: "/signup", search: { checkout: interval }, className: "no-underline w-full", onClick: onClose, children: /* @__PURE__ */ jsx(Button, { className: "w-full", variant: "gold", children: "Sign up" }) }) }),
    /* @__PURE__ */ jsxs("div", { className: "my-6", children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-accent mb-3", children: "What's included" }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-x-4 gap-y-3", children: PREMIUM_BENEFITS.map((text) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-sm", children: [
        /* @__PURE__ */ jsx(Check, { className: "w-4 h-4 shrink-0 mt-0.5 text-yellow-300" }),
        /* @__PURE__ */ jsx("span", { children: text })
      ] }, text)) })
    ] })
  ] });
}
function formatPrice(cents, currency, fractionDigits) {
  const amount = cents / 100;
  const digits = fractionDigits ?? (amount % 1 === 0 ? 0 : 2);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
function PremiumUpsellPanel({ user, billing, prices, onClose }) {
  const [interval, setInterval2] = useState("annual");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trpc/billing.createCheckout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { interval } })
      });
      const data = await res.json();
      const url = data?.result?.data?.json?.url;
      if (url) {
        window.location.href = url;
      } else {
        const msg = data?.error?.json?.message || "Failed to create checkout session.";
        setError(msg);
        setCheckoutLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  };
  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/trpc/billing.createPortalSession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: {} })
      });
      const data = await res.json();
      const url = data?.result?.data?.json?.url;
      if (url) {
        window.location.href = url;
      } else {
        setPortalLoading(false);
      }
    } catch {
      setPortalLoading(false);
    }
  };
  if (billing?.premiumGranted) {
    return /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center gap-2 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: "Lifetime Premium" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-accent", children: "No subscription required, ever." })
      ] }),
      /* @__PURE__ */ jsx(Badge, { className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", children: "Active" })
    ] });
  }
  if (billing?.subscription?.status === "ACTIVE") {
    const periodEnd = billing.subscription.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }) : "N/A";
    return /* @__PURE__ */ jsx("div", { className: "space-y-3", children: /* @__PURE__ */ jsxs("div", { className: "p-4 rounded-lg bg-accent", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center w-full mb-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "font-medium", children: "Premium Subscription" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-zinc-500 dark:text-zinc-400", children: billing.subscription.cancelAtPeriodEnd ? `Cancels on ${periodEnd}` : `Next billing date: ${periodEnd}` })
        ] }),
        /* @__PURE__ */ jsx(Badge, { className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", children: "Active" })
      ] }),
      /* @__PURE__ */ jsx(Button, { onClick: handlePortal, "aria-disabled": portalLoading, className: "w-full", children: portalLoading ? /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin w-4 h-4" }) : "Manage Subscription" })
    ] }) });
  }
  const annualPerMonth = prices ? formatPrice(prices.annual.amount / 12, prices.annual.currency) : null;
  const annualTotal = prices ? formatPrice(prices.annual.amount, prices.annual.currency, 2) : null;
  const monthlyPrice = prices ? formatPrice(prices.monthly.amount, prices.monthly.currency) : null;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3 rounded-lg", children: [
    /* @__PURE__ */ jsx(
      PlanHighlightCard,
      {
        interval,
        onIntervalChange: setInterval2,
        annualPerMonth,
        annualTotal,
        monthlyPrice,
        user,
        checkoutLoading,
        onCheckout: handleCheckout,
        onClose
      }
    ),
    error && /* @__PURE__ */ jsx(Alert, { type: "error", children: error })
  ] });
}
function Tabs({
  options,
  value,
  onChange,
  size = "default",
  children
}) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabListRef = useRef(null);
  const scrollRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  useEffect(() => {
    const list = tabListRef.current;
    if (!list) return;
    const tabs = list.querySelectorAll('[role="tab"]');
    const tab = tabs[selectedIndex];
    if (tab) {
      setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth });
    }
  }, [selectedIndex]);
  const onMouseDown = (e) => {
    drag.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: scrollRef.current?.scrollLeft ?? 0,
      moved: false
    };
  };
  const onMouseMove = (e) => {
    if (!drag.current.active || !scrollRef.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    scrollRef.current.scrollLeft = drag.current.scrollLeft - dx;
  };
  const onMouseUp = () => {
    drag.current.active = false;
  };
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.stopPropagation();
      drag.current.moved = false;
    }
  };
  return /* @__PURE__ */ jsxs(
    TabGroup,
    {
      selectedIndex,
      onChange: (index) => onChange(options[index].value),
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: scrollRef,
            className: "overflow-x-auto scrollbar-none",
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onMouseLeave: onMouseUp,
            onClickCapture,
            children: /* @__PURE__ */ jsx("div", { ref: tabListRef, children: /* @__PURE__ */ jsxs(TabList, { className: `relative flex rounded-full bg-zinc-100 inset-shadow-default border border-t-zinc-300/80 border-zinc-200/50 dark:bg-zinc-800 dark:border-zinc-700/80 dark:border-t-zinc-500/50 w-fit min-w-max ${size === "sm" ? "p-0.5" : "p-1"}`, children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  "aria-hidden": "true",
                  className: "absolute inset-y-1 rounded-full btn transition-[left,width] duration-100",
                  style: { left: indicator.left, width: indicator.width }
                }
              ),
              options.map((option) => /* @__PURE__ */ jsx(
                Tab,
                {
                  className: `relative z-10 rounded-full border border-transparent transition-all duration-400 cursor-pointer select-none whitespace-nowrap text-zinc-500 data-selected:text-zinc-900 dark:text-zinc-400 dark:data-selected:text-zinc-100 hover:not-data-selected:opacity-80 ${size === "sm" ? "px-3 py-0.5 text-xs" : "px-4 py-1 text-sm"}`,
                  children: option.label
                },
                option.value
              ))
            ] }) })
          }
        ),
        children && /* @__PURE__ */ jsx(TabPanels, { children: children.map((panel, i) => /* @__PURE__ */ jsx(TabPanel, { tabIndex: -1, children: panel }, i)) })
      ]
    }
  );
}
const TAB_OPTIONS = [
  { label: "Settings", value: "settings" },
  { label: "Subscription", value: "subscription" }
];
function AppDialog({ isOpen, initialTab, onClose, user }) {
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [billing, setBilling] = useState(null);
  const [referral, setReferral] = useState(null);
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/trpc/billing.getPrices");
        const data = await res.json();
        setPrices(data?.result?.data?.json ?? null);
      } catch {
      }
    };
    fetchPrices();
  }, []);
  useEffect(() => {
    if (!user) {
      setBilling(null);
      setReferral(null);
      return;
    }
    if (!isOpen) return;
    const fetchAccountData = async () => {
      setLoading(true);
      try {
        const [billingRes, referralRes] = await Promise.all([
          fetch("/api/trpc/billing.getStatus"),
          fetch("/api/trpc/billing.getReferralInfo")
        ]);
        const [billingData, referralData] = await Promise.all([
          billingRes.json(),
          referralRes.json()
        ]);
        setBilling(billingData?.result?.data?.json ?? null);
        setReferral(referralData?.result?.data?.json ?? null);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchAccountData();
  }, [isOpen, user?.id]);
  return /* @__PURE__ */ jsxs(
    Dialog,
    {
      isOpen,
      setIsOpen: (open) => {
        if (!open) onClose();
      },
      onOpen: pauseGame,
      onClose: resumeGame,
      children: [
        /* @__PURE__ */ jsx("div", { className: "p-4 pb-0 pr-12", children: /* @__PURE__ */ jsx(
          Tabs,
          {
            options: TAB_OPTIONS,
            value: activeTab,
            onChange: setActiveTab
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "h-[360px] overflow-y-auto scrollbar-thin p-4", children: [
          activeTab === "settings" && /* @__PURE__ */ jsx(SettingsPanel, {}),
          activeTab === "subscription" && (loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-4", children: /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin w-5 h-5" }) }) : user?.isPremium ? /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(PremiumUpsellPanel, { user, billing, prices, onClose }),
            billing?.premiumExpiresAt && !billing?.premiumGranted && /* @__PURE__ */ jsx(PromoCodeSection, {}),
            billing?.premiumGranted && /* @__PURE__ */ jsx(ReferralSection, { referral })
          ] }) : /* @__PURE__ */ jsx(PremiumUpsellPanel, { user, billing, prices, onClose }))
        ] })
      ]
    }
  );
}
function Shimmer() {
  const shimmerRef = useRef(null);
  useEffect(() => {
    if (!shimmerRef.current) return;
    const anim = animate(shimmerRef.current, {
      translateX: ["-100%", "200%"],
      duration: 600,
      ease: "inOut(2)",
      loop: true,
      loopDelay: 2400
    });
    return () => {
      anim.cancel();
    };
  }, []);
  return /* @__PURE__ */ jsx(
    "span",
    {
      ref: shimmerRef,
      "aria-hidden": "true",
      className: "absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[20deg]"
    }
  );
}
function GoldPillButton({ onClick, user }) {
  if (!user) {
    return /* @__PURE__ */ jsx(Link, { to: "/signup", className: "block no-underline text-inherit", children: /* @__PURE__ */ jsxs(Button, { size: "sm", variant: "gold", children: [
      /* @__PURE__ */ jsx(Shimmer, {}),
      "Sign up"
    ] }) });
  }
  return /* @__PURE__ */ jsxs(Button, { size: "sm", variant: "gold", onClick, children: [
    /* @__PURE__ */ jsx(Shimmer, {}),
    "Subscribe"
  ] });
}
function Nav({ user }) {
  const navigate = useNavigate();
  const router2 = useRouter();
  const matchRoute = useMatchRoute();
  const isIndex = matchRoute({ to: "/" });
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const [appDialogOpen, setAppDialogOpen] = useState(false);
  const [appDialogTab, setAppDialogTab] = useState("settings");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const handleSignOut = async () => {
    const { signOut: signOut2 } = await Promise.resolve().then(() => authClient);
    await signOut2({
      fetchOptions: {
        onSuccess: async () => {
          await router2.invalidate();
          navigate({ to: "/" });
        }
      }
    });
  };
  return /* @__PURE__ */ jsxs("nav", { className: "w-min mx-auto", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-full bg-default-shadow justify-center gap-2 mb-2 h-9 px-2 text-sm", children: [
      !isIndex && /* @__PURE__ */ jsx(Link, { to: "/", className: "block no-underline text-inherit", children: /* @__PURE__ */ jsx(Button, { size: "sm", children: "Play" }) }),
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          onClick: () => {
            setAppDialogTab("settings");
            setAppDialogOpen(true);
          },
          children: "Settings"
        }
      ),
      user?.isPremium && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { size: "sm", onClick: () => setArchiveOpen(true), children: "Archive" }),
        /* @__PURE__ */ jsx(
          Dialog,
          {
            title: "Archive",
            isOpen: archiveOpen,
            setIsOpen: setArchiveOpen,
            onOpen: () => pauseGame(),
            onClose: () => resumeGame()
          }
        )
      ] }),
      !user?.isPremium && /* @__PURE__ */ jsx(GoldPillButton, { user, onClick: () => {
        setAppDialogTab("subscription");
        setAppDialogOpen(true);
      } }),
      user ? /* @__PURE__ */ jsx(Button, { size: "sm", onClick: handleSignOut, children: "Sign Out" }) : /* @__PURE__ */ jsx(Link, { to: "/signin", className: "block no-underline text-inherit", children: /* @__PURE__ */ jsx(Button, { size: "sm", children: "Sign In" }) })
    ] }),
    /* @__PURE__ */ jsx(
      AppDialog,
      {
        isOpen: appDialogOpen,
        initialTab: appDialogTab,
        onClose: () => setAppDialogOpen(false),
        user
      }
    )
  ] });
}
function NotFound({ children }) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2 p-2", children: [
    /* @__PURE__ */ jsx("div", { className: "text-gray-600 dark:text-gray-400", children: children || /* @__PURE__ */ jsx("p", { children: "The page you are looking for does not exist." }) }),
    /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 flex-wrap", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => window.history.back(),
          className: "bg-emerald-500 text-white px-2 py-1 rounded-sm uppercase font-black text-sm",
          children: "Go back"
        }
      ),
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/",
          className: "bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm",
          children: "Start Over"
        }
      )
    ] })
  ] });
}
const seo = ({
  title,
  description,
  keywords,
  image
}) => {
  const tags = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:creator", content: "@grammble" },
    { name: "twitter:site", content: "@grammble" },
    { name: "og:type", content: "website" },
    { name: "og:title", content: title },
    { name: "og:description", content: description },
    ...image ? [
      { name: "twitter:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "og:image", content: image }
    ] : []
  ];
  return tags;
};
const THEME_COOKIE = "_preferred-theme";
const getInitialAppDataServerFn_createServerFn_handler = createSsrRpc("d4508c3d64d982d9f85070461b987b0c89f0127058a3ff7c4f6087b6875eff3a");
const getInitialAppDataServerFn = createServerFn({
  method: "GET"
}).handler(getInitialAppDataServerFn_createServerFn_handler, async () => {
  const [{
    getCookie,
    getRequestHeaders,
    setCookie
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }, {
    auth: auth2
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js"), import("./auth-CoiYOFBV.js").then((n) => n.j)]);
  const headers = new Headers(getRequestHeaders());
  let trpcUser = null;
  let rootUser = null;
  let theme = getCookie(THEME_COOKIE) || "light";
  try {
    const session = await auth2.api.getSession({
      headers
    });
    if (session?.user) {
      const {
        prismaClient: prismaClient2
      } = await import("./prisma-CDBmz4-v.js");
      const dbUser = await prismaClient2.user.findUnique({
        where: {
          id: session.user.id
        },
        select: {
          isPremium: true,
          premiumGranted: true,
          premiumExpiresAt: true
        }
      });
      let isPremium = dbUser?.isPremium ?? false;
      if (isPremium && dbUser?.premiumExpiresAt && dbUser.premiumExpiresAt < /* @__PURE__ */ new Date()) {
        isPremium = false;
        prismaClient2.user.update({
          where: {
            id: session.user.id
          },
          data: {
            isPremium: false
          }
        }).catch((err) => console.error("Failed to expire premium:", err));
      }
      trpcUser = {
        ...session.user,
        isPremium
      };
      rootUser = {
        ...trpcUser,
        premiumGranted: dbUser?.premiumGranted ?? false
      };
      const settings = await prismaClient2.settings.findUnique({
        where: {
          userId: session.user.id
        },
        select: {
          theme: true
        }
      });
      if (settings?.theme) {
        theme = settings.theme === "dark" ? "dark" : "light";
        setCookie(THEME_COOKIE, theme);
      }
    }
  } catch (err) {
    console.error("[getInitialAppData] auth/user lookup failed:", err);
  }
  const caller = createCaller({
    user: trpcUser
  });
  const daily = await caller.game.getDaily();
  return {
    user: rootUser,
    theme,
    daily
  };
});
const getUserStatsServerFn_createServerFn_handler = createSsrRpc("4596ef5b4feedd7a217fec1989ef269d0220462576d8c9b794f5882f5457cdad");
const getUserStatsServerFn = createServerFn({
  method: "GET"
}).handler(getUserStatsServerFn_createServerFn_handler, async () => {
  const [{
    getRequestHeaders
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js")]);
  const headers = new Headers(getRequestHeaders());
  const ctx = await createTRPCContextFromHeaders(headers);
  return createCaller(ctx).game.getUserStats();
});
const submitGuessServerFn_createServerFn_handler = createSsrRpc("70d43dbaf985dbf4f6b04edf27586d5d094e09ab0fd755fe24f1d1c122c5738a");
const submitGuessServerFn = createServerFn({
  method: "POST"
}).inputValidator(v.object({
  guess: v.string()
})).handler(submitGuessServerFn_createServerFn_handler, async ({
  data
}) => {
  const [{
    getRequestHeaders
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js")]);
  const headers = new Headers(getRequestHeaders());
  const ctx = await createTRPCContextFromHeaders(headers);
  return createCaller(ctx).game.submitGuess(data);
});
const syncAnonymousSessionServerFn_createServerFn_handler = createSsrRpc("1c0f9ace5600a2f1189a668721c52618fa900f8c2f13e80d3f5d74f76c64f0e9");
const syncAnonymousSessionServerFn = createServerFn({
  method: "POST"
}).inputValidator(v.object({
  guesses: v.array(v.string())
})).handler(syncAnonymousSessionServerFn_createServerFn_handler, async ({
  data
}) => {
  const [{
    getRequestHeaders
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js")]);
  const headers = new Headers(getRequestHeaders());
  const ctx = await createTRPCContextFromHeaders(headers);
  return createCaller(ctx).game.syncAnonymousSession(data);
});
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1e3,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1
    }
  }
});
const STORAGE_KEY = "grammble-game";
function useAnonymousSessionSync(userId) {
  const router2 = useRouter();
  const ranForUserRef = useRef(null);
  useEffect(() => {
    if (!userId) return;
    if (ranForUserRef.current === userId) return;
    ranForUserRef.current = userId;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse persisted game state:", err);
      useGameStore.persist.clearStorage();
      return;
    }
    const persistedDate = parsed?.state?.date;
    const allGuesses = parsed?.state?.guesses ?? [];
    const currentGuessIndex = parsed?.state?.currentGuessIndex ?? 0;
    const guesses = allGuesses.slice(0, currentGuessIndex);
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const shouldSync = persistedDate === today && guesses.length > 0;
    const finish = () => {
      useGameStore.persist.clearStorage();
      router2.invalidate();
    };
    if (!shouldSync) {
      finish();
      return;
    }
    syncAnonymousSessionServerFn({ data: { guesses } }).catch((err) => {
      console.error("Failed to sync anonymous session:", err);
    }).finally(finish);
  }, [userId, router2]);
}
const DISMISS_MS = 2500;
const SWIPE_THRESHOLD = 4;
const MAX_DRAG = 40;
function Toast() {
  const toast = useGameStore((s) => s.toast);
  const setToast = useGameStore((s) => s.setToast);
  const [cached, setCached] = useState(null);
  const dragRef = useRef(null);
  const shakeRef = useRef(null);
  const shakeIfError = (t) => {
    if (t?.type === "error" && shakeRef.current) {
      animate(shakeRef.current, {
        x: [
          { to: -8, duration: 60 },
          { to: 8, duration: 60 },
          { to: -6, duration: 60 },
          { to: 6, duration: 60 },
          { to: 0, duration: 60 }
        ],
        ease: "inOut(2)"
      });
    }
  };
  useEffect(() => {
    if (!toast) return;
    setCached(toast);
    shakeIfError(toast);
    const id = window.setTimeout(() => setToast(null), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [toast, setToast]);
  useEffect(() => {
    const el = dragRef.current;
    if (!cached || !el) return;
    let instance = null;
    let cancelled = false;
    import("animejs").then(({ createDraggable }) => {
      if (cancelled) return;
      instance = createDraggable(el, {
        y: true,
        x: false,
        container: [-MAX_DRAG, 0, MAX_DRAG, 0],
        containerFriction: 0.8,
        releaseContainerFriction: 0.9,
        cursor: { onHover: "grab", onGrab: "grabbing" },
        releaseEase: "out(3)",
        onRelease: (self) => {
          if (Math.abs(self.y) >= SWIPE_THRESHOLD) {
            setToast(null);
          } else {
            self.reset();
          }
        }
      });
    });
    return () => {
      cancelled = true;
      instance?.revert();
    };
  }, [cached, setToast]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      "aria-live": "polite",
      "aria-atomic": "true",
      className: "fixed inset-x-0 top-0 z-[9999] flex justify-center pt-4 pointer-events-none",
      children: /* @__PURE__ */ jsx(
        Transition,
        {
          show: !!toast,
          as: "div",
          enter: "transition duration-200 ease-out",
          enterFrom: "opacity-0 -translate-y-4",
          enterTo: "opacity-100 translate-y-0",
          leave: "transition duration-150 ease-in",
          leaveFrom: "opacity-100 translate-y-0",
          leaveTo: "opacity-0 -translate-y-4",
          afterEnter: () => shakeIfError(cached),
          afterLeave: () => setCached(null),
          children: cached && /* @__PURE__ */ jsx(
            "div",
            {
              ref: dragRef,
              role: "status",
              style: { touchAction: "none" },
              className: "pointer-events-auto select-none",
              children: /* @__PURE__ */ jsx("div", { ref: shakeRef, children: /* @__PURE__ */ jsxs(Alert, { type: cached.type, className: "shadow-md pr-8 relative min-w-[200px]", children: [
                /* @__PURE__ */ jsx("span", { children: cached.message }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    "aria-label": "Dismiss notification",
                    onClick: () => setToast(null),
                    onPointerDown: (e) => e.stopPropagation(),
                    className: clsx(
                      "absolute top-1/2 -translate-y-1/2 right-2",
                      "inline-flex items-center justify-center w-5 h-5 rounded",
                      "opacity-70 hover:opacity-100 focus:opacity-100",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                    ),
                    children: /* @__PURE__ */ jsx(X, { className: "w-4 h-4", "aria-hidden": "true" })
                  }
                )
              ] }) })
            }
          )
        }
      )
    }
  );
}
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC"
];
function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}
const STUCK_TIMEOUT_MS = 15e3;
const INITIAL_LOADER_FADE_MS = 500;
const STYLES = `
.initial-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: 1fr auto 1fr;
  background: #fafafa;
  color: #18181b;
  overflow: hidden;
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
  opacity: 1;
  transition: opacity ${INITIAL_LOADER_FADE_MS}ms ease-out;
}
.initial-loader.is-fading {
  opacity: 0;
  pointer-events: none;
}
[data-theme="dark"] .initial-loader {
  background: #09090b;
  color: #f4f4f5;
}
.initial-loader__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  align-self: center;
  grid-row: 2;
}
.initial-loader__mark {
  width: 96px;
  height: 96px;
  border-radius: 24px / 28px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #fef08a, #facc15);
  color: #18181b;
  font-weight: 800;
  font-size: 52px;
  border: 1px solid #fde047;
  box-shadow: 0 8px 0 rgb(216, 175, 13), inset 0 2px 0 rgba(255,255,255,.55);
  position: relative;
  overflow: hidden;
}
.initial-loader__mark::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.5) 50%, transparent 70%);
  background-size: 250% 100%;
  animation: initial-loader-sheen 2.4s ease-in-out infinite;
}
@keyframes initial-loader-sheen {
  0%, 100% { background-position: 200% 0; }
  50% { background-position: -100% 0; }
}
.initial-loader__name {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1;
}
.initial-loader__status {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f4f4f5;
  border: 1px solid #e4e4e7;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 12px;
  color: #52525b;
}
[data-theme="dark"] .initial-loader__status {
  background: #18181b;
  border-color: #27272a;
  color: #a1a1aa;
}
.initial-loader__spinner {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid #d4d4d8;
  border-top-color: #facc15;
  animation: initial-loader-spin .9s linear infinite;
}
[data-theme="dark"] .initial-loader__spinner {
  border-color: #3f3f46;
  border-top-color: #facc15;
}
@keyframes initial-loader-spin {
  to { transform: rotate(360deg); }
}
.initial-loader__footer {
  align-self: end;
  justify-self: center;
  padding-bottom: 28px;
  font-size: 11px;
  letter-spacing: .15em;
  color: #a1a1aa;
  text-transform: uppercase;
}
[data-theme="dark"] .initial-loader__footer {
  color: #52525b;
}
`;
const STUCK_SCRIPT = `
window.setTimeout(function() {
  var status = document.querySelector('.initial-loader__status');
  var loader = document.querySelector('.initial-loader');
  if (status && loader && loader.isConnected) {
    status.textContent = 'Loading is taking longer than expected. Please refresh.';
  }
}, ${STUCK_TIMEOUT_MS});
`;
function InitialLoader({
  puzzleNumber,
  date,
  isFading = false
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { dangerouslySetInnerHTML: { __html: STYLES } }),
    /* @__PURE__ */ jsx("script", { dangerouslySetInnerHTML: { __html: STUCK_SCRIPT } }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: isFading ? "initial-loader is-fading" : "initial-loader",
        "aria-live": "polite",
        "aria-busy": !isFading,
        children: [
          /* @__PURE__ */ jsxs("div", { className: "initial-loader__center", children: [
            /* @__PURE__ */ jsx("div", { className: "initial-loader__mark", children: "G" }),
            /* @__PURE__ */ jsx("div", { className: "initial-loader__name", children: "Grammble" }),
            /* @__PURE__ */ jsxs("div", { className: "initial-loader__status", children: [
              /* @__PURE__ */ jsx("div", { className: "initial-loader__spinner" }),
              /* @__PURE__ */ jsx("span", { children: "Loading today's puzzle" })
            ] }),
            /* @__PURE__ */ jsx("noscript", { children: /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: "#a1a1aa", textAlign: "center" }, children: [
              "JavaScript is required to play Grammble.",
              /* @__PURE__ */ jsx("br", {}),
              "Please enable it in your browser settings."
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "initial-loader__footer", children: [
            "No. ",
            puzzleNumber,
            " · ",
            formatDate(date)
          ] })
        ]
      }
    )
  ] });
}
const Route$a = createRootRoute({
  beforeLoad: async () => {
    const { user, theme, daily } = await getInitialAppDataServerFn();
    return {
      user: user ?? void 0,
      theme,
      daily
    };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8"
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      ...seo({
        keywords: "grammble, word game, two letter game, daily word game",
        title: "grammble - the two letter daily word game",
        description: `Play grammble today - the two letter daily word game.`
      })
    ],
    scripts: [
      {
        children: `
(function() {
  const storageKey = '_preferred-theme';
  
  // Function to get cookie value
  function getCookie(name) {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
  
  // Read cookie first, fall back to media preference if no cookie exists
  let theme = getCookie(storageKey);
  
  if (!theme) {
    // No cookie exists, detect from media preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
    // Set cookie for server-side reading (expires in 1 year)
    document.cookie = storageKey + '=' + theme + ';path=/;max-age=' + (60 * 60 * 24 * 365);
  }
  
  // Apply theme immediately to prevent flash
  document.documentElement.setAttribute('data-theme', theme);
})();
`
      },
      {
        children: `
(function() {
  document.addEventListener('mousedown', function() {
    document.documentElement.classList.add('using-mouse');
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      document.documentElement.classList.remove('using-mouse');
    }
  });
})();
`
      }
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png"
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png"
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png"
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" }
    ]
  }),
  errorComponent: (props) => {
    return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(DefaultCatchBoundary, { ...props }) });
  },
  notFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
  component: RootComponent
});
function RootComponent() {
  return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
function RootDocument({ children }) {
  const { theme, user, daily } = Route$a.useRouteContext();
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isLoaderMounted, setIsLoaderMounted] = React.useState(true);
  useAnonymousSessionSync(user?.id);
  React.useEffect(() => {
    setIsHydrated(true);
    const timer = window.setTimeout(
      () => setIsLoaderMounted(false),
      INITIAL_LOADER_FADE_MS
    );
    return () => window.clearTimeout(timer);
  }, []);
  return /* @__PURE__ */ jsxs("html", { "data-theme": theme, suppressHydrationWarning: true, children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx("div", { inert: !isHydrated, children: /* @__PURE__ */ jsx(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsxs(ThemeProvider, { theme, children: [
        /* @__PURE__ */ jsx(Toast, {}),
        /* @__PURE__ */ jsx("div", { className: "toggle-theme-color w-full min-h-screen py-4", children: /* @__PURE__ */ jsxs("div", { className: "max-w-[360px] mx-auto", children: [
          /* @__PURE__ */ jsx(Nav, { user }),
          children
        ] }) })
      ] }) }) }),
      isLoaderMounted && /* @__PURE__ */ jsx(
        InitialLoader,
        {
          puzzleNumber: daily.puzzleNumber,
          date: daily.date,
          isFading: isHydrated
        }
      ),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const $$splitComponentImporter$3 = () => import("./verify-email-QFNLNmLM.js");
const verifyTokenSchema = v.object({
  token: v.optional(v.string())
});
const verifyEmailFn_createServerFn_handler = createSsrRpc("3ca53f453041cc086031d37e1b534f81559d29e55683f5c04d0dcdd5cfa0edf5");
const verifyEmailFn = createServerFn({
  method: "POST"
}).inputValidator(verifyTokenSchema).handler(verifyEmailFn_createServerFn_handler, async ({
  data
}) => {
  const {
    prismaClient: prismaClient2
  } = await import("./prisma-CDBmz4-v.js");
  const token = data.token;
  if (!token) {
    return {
      success: false,
      message: "We couldn't verify your email. Please try clicking the link in your email again."
    };
  }
  const verification = await prismaClient2.verification.findFirst({
    where: {
      value: token
    }
  });
  if (!verification) {
    return {
      success: false,
      message: "Invalid or expired verification link."
    };
  }
  if (/* @__PURE__ */ new Date() > verification.expiresAt) {
    await prismaClient2.verification.delete({
      where: {
        id: verification.id
      }
    });
    return {
      success: false,
      message: "This verification link has expired."
    };
  }
  const email = verification.identifier;
  const user = await prismaClient2.user.findUnique({
    where: {
      email
    }
  });
  if (!user) {
    return {
      success: false,
      message: "We couldn't find an account associated with this email. Please try signing up again."
    };
  }
  if (user.emailVerified) {
    await prismaClient2.verification.delete({
      where: {
        id: verification.id
      }
    });
    return {
      success: true,
      message: "Your email has already been verified."
    };
  }
  await prismaClient2.user.update({
    where: {
      id: user.id
    },
    data: {
      emailVerified: true
    }
  });
  await prismaClient2.verification.delete({
    where: {
      id: verification.id
    }
  });
  return {
    success: true,
    message: "Your email has been successfully verified!"
  };
});
const Route$9 = createFileRoute("/verify-email")({
  validateSearch: (search) => v.parse(verifyTokenSchema, search),
  loaderDeps: ({
    search: {
      token
    }
  }) => ({
    token
  }),
  preload: false,
  staleTime: Infinity,
  gcTime: 0,
  loader: async ({
    deps: {
      token
    }
  }) => {
    if (!token) {
      return {
        success: false,
        message: "Verification token is required. Please check your email for the complete verification link."
      };
    }
    return await verifyEmailFn({
      data: {
        token
      }
    });
  },
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
const $$splitComponentImporter$2 = () => import("./signup-D8Y4l9E2.js");
const signupSearchSchema = v.object({
  invite: v.optional(v.string()),
  checkout: v.optional(v.picklist(["monthly", "annual"]))
});
const Route$8 = createFileRoute("/signup")({
  validateSearch: (search) => v.parse(signupSearchSchema, search),
  beforeLoad: async ({
    context
  }) => {
    if (context?.user) {
      throw redirect({
        to: "/dashboard"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
const $$splitComponentImporter$1 = () => import("./signin-DHTqc49t.js");
const Route$7 = createFileRoute("/signin")({
  beforeLoad: async ({
    context
  }) => {
    if (context?.user) {
      throw redirect({
        to: "/dashboard"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
const redirectPlugin = {
  id: "redirect",
  name: "Redirect",
  hooks: { onSuccess(context) {
    if (context.data?.url && context.data?.redirect) {
      if (typeof window !== "undefined" && window.location) {
        if (window.location) try {
          window.location.href = context.data.url;
        } catch {
        }
      }
    }
  } }
};
const PROTO_POLLUTION_PATTERNS = {
  proto: /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/,
  constructor: /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/,
  protoShort: /"__proto__"\s*:/,
  constructorShort: /"constructor"\s*:/
};
const JSON_SIGNATURE = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
const SPECIAL_VALUES = {
  true: true,
  false: false,
  null: null,
  undefined: void 0,
  nan: NaN,
  infinity: Number.POSITIVE_INFINITY,
  "-infinity": Number.NEGATIVE_INFINITY
};
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;
function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}
function parseISODate(value) {
  const match = ISO_DATE_REGEX.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, ms, offsetSign, offsetHour, offsetMinute] = match;
  const date = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10), ms ? parseInt(ms.padEnd(3, "0"), 10) : 0));
  if (offsetSign) {
    const offset = (parseInt(offsetHour, 10) * 60 + parseInt(offsetMinute, 10)) * (offsetSign === "+" ? -1 : 1);
    date.setUTCMinutes(date.getUTCMinutes() + offset);
  }
  return isValidDate(date) ? date : null;
}
function betterJSONParse(value, options = {}) {
  const { strict = false, warnings = false, reviver, parseDates = true } = options;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length > 0 && trimmed[0] === '"' && trimmed.endsWith('"') && !trimmed.slice(1, -1).includes('"')) return trimmed.slice(1, -1);
  const lowerValue = trimmed.toLowerCase();
  if (lowerValue.length <= 9 && lowerValue in SPECIAL_VALUES) return SPECIAL_VALUES[lowerValue];
  if (!JSON_SIGNATURE.test(trimmed)) {
    if (strict) throw new SyntaxError("[better-json] Invalid JSON");
    return value;
  }
  if (Object.entries(PROTO_POLLUTION_PATTERNS).some(([key, pattern]) => {
    const matches = pattern.test(trimmed);
    if (matches && warnings) console.warn(`[better-json] Detected potential prototype pollution attempt using ${key} pattern`);
    return matches;
  }) && strict) throw new Error("[better-json] Potential prototype pollution attempt detected");
  try {
    const secureReviver = (key, value$1) => {
      if (key === "__proto__" || key === "constructor" && value$1 && typeof value$1 === "object" && "prototype" in value$1) {
        if (warnings) console.warn(`[better-json] Dropping "${key}" key to prevent prototype pollution`);
        return;
      }
      if (parseDates && typeof value$1 === "string") {
        const date = parseISODate(value$1);
        if (date) return date;
      }
      return reviver ? reviver(key, value$1) : value$1;
    };
    return JSON.parse(trimmed, secureReviver);
  } catch (error) {
    if (strict) throw error;
    return value;
  }
}
function parseJSON(value, options = { strict: true }) {
  return betterJSONParse(value, options);
}
let clean = Symbol("clean");
let listenerQueue = [];
let lqIndex = 0;
const QUEUE_ITEMS_PER_LISTENER = 4;
const atom = /* @__NO_SIDE_EFFECTS__ */ (initialValue) => {
  let listeners = [];
  let $atom = {
    get() {
      if (!$atom.lc) {
        $atom.listen(() => {
        })();
      }
      return $atom.value;
    },
    lc: 0,
    listen(listener) {
      $atom.lc = listeners.push(listener);
      return () => {
        for (let i = lqIndex + QUEUE_ITEMS_PER_LISTENER; i < listenerQueue.length; ) {
          if (listenerQueue[i] === listener) {
            listenerQueue.splice(i, QUEUE_ITEMS_PER_LISTENER);
          } else {
            i += QUEUE_ITEMS_PER_LISTENER;
          }
        }
        let index = listeners.indexOf(listener);
        if (~index) {
          listeners.splice(index, 1);
          if (!--$atom.lc) $atom.off();
        }
      };
    },
    notify(oldValue, changedKey) {
      let runListenerQueue = !listenerQueue.length;
      for (let listener of listeners) {
        listenerQueue.push(listener, $atom.value, oldValue, changedKey);
      }
      if (runListenerQueue) {
        for (lqIndex = 0; lqIndex < listenerQueue.length; lqIndex += QUEUE_ITEMS_PER_LISTENER) {
          listenerQueue[lqIndex](
            listenerQueue[lqIndex + 1],
            listenerQueue[lqIndex + 2],
            listenerQueue[lqIndex + 3]
          );
        }
        listenerQueue.length = 0;
      }
    },
    /* It will be called on last listener unsubscribing.
       We will redefine it in onMount and onStop. */
    off() {
    },
    set(newValue) {
      let oldValue = $atom.value;
      if (oldValue !== newValue) {
        $atom.value = newValue;
        $atom.notify(oldValue);
      }
    },
    subscribe(listener) {
      let unbind = $atom.listen(listener);
      listener($atom.value);
      return unbind;
    },
    value: initialValue
  };
  if (process.env.NODE_ENV !== "production") {
    $atom[clean] = () => {
      listeners = [];
      $atom.lc = 0;
      $atom.off();
    };
  }
  return $atom;
};
const MOUNT = 5;
const UNMOUNT = 6;
const REVERT_MUTATION = 10;
let on = (object, listener, eventKey, mutateStore) => {
  object.events = object.events || {};
  if (!object.events[eventKey + REVERT_MUTATION]) {
    object.events[eventKey + REVERT_MUTATION] = mutateStore((eventProps) => {
      object.events[eventKey].reduceRight((event, l) => (l(event), event), {
        shared: {},
        ...eventProps
      });
    });
  }
  object.events[eventKey] = object.events[eventKey] || [];
  object.events[eventKey].push(listener);
  return () => {
    let currentListeners = object.events[eventKey];
    let index = currentListeners.indexOf(listener);
    currentListeners.splice(index, 1);
    if (!currentListeners.length) {
      delete object.events[eventKey];
      object.events[eventKey + REVERT_MUTATION]();
      delete object.events[eventKey + REVERT_MUTATION];
    }
  };
};
let STORE_UNMOUNT_DELAY = 1e3;
let onMount = ($store, initialize) => {
  let listener = (payload) => {
    let destroy = initialize(payload);
    if (destroy) $store.events[UNMOUNT].push(destroy);
  };
  return on($store, listener, MOUNT, (runListeners) => {
    let originListen = $store.listen;
    $store.listen = (...args) => {
      if (!$store.lc && !$store.active) {
        $store.active = true;
        runListeners();
      }
      return originListen(...args);
    };
    let originOff = $store.off;
    $store.events[UNMOUNT] = [];
    $store.off = () => {
      originOff();
      setTimeout(() => {
        if ($store.active && !$store.lc) {
          $store.active = false;
          for (let destroy of $store.events[UNMOUNT]) destroy();
          $store.events[UNMOUNT] = [];
        }
      }, STORE_UNMOUNT_DELAY);
    };
    if (process.env.NODE_ENV !== "production") {
      let originClean = $store[clean];
      $store[clean] = () => {
        for (let destroy of $store.events[UNMOUNT]) destroy();
        $store.events[UNMOUNT] = [];
        $store.active = false;
        originClean();
      };
    }
    return () => {
      $store.listen = originListen;
      $store.off = originOff;
    };
  });
};
function listenKeys($store, keys, listener) {
  let keysSet = new Set(keys).add(void 0);
  return $store.listen((value, oldValue, changed) => {
    if (keysSet.has(changed)) {
      listener(value, oldValue, changed);
    }
  });
}
const isServer = () => typeof window === "undefined";
const useAuthQuery = (initializedAtom, path, $fetch, options) => {
  const value = /* @__PURE__ */ atom({
    data: null,
    error: null,
    isPending: true,
    isRefetching: false,
    refetch: (queryParams) => fn(queryParams)
  });
  const fn = async (queryParams) => {
    return new Promise((resolve) => {
      const opts = typeof options === "function" ? options({
        data: value.get().data,
        error: value.get().error,
        isPending: value.get().isPending
      }) : options;
      $fetch(path, {
        ...opts,
        query: {
          ...opts?.query,
          ...queryParams?.query
        },
        async onSuccess(context) {
          value.set({
            data: context.data,
            error: null,
            isPending: false,
            isRefetching: false,
            refetch: value.value.refetch
          });
          await opts?.onSuccess?.(context);
        },
        async onError(context) {
          const { request } = context;
          const retryAttempts = typeof request.retry === "number" ? request.retry : request.retry?.attempts;
          const retryAttempt = request.retryAttempt || 0;
          if (retryAttempts && retryAttempt < retryAttempts) return;
          value.set({
            error: context.error,
            data: null,
            isPending: false,
            isRefetching: false,
            refetch: value.value.refetch
          });
          await opts?.onError?.(context);
        },
        async onRequest(context) {
          const currentValue = value.get();
          value.set({
            isPending: currentValue.data === null,
            data: currentValue.data,
            error: null,
            isRefetching: true,
            refetch: value.value.refetch
          });
          await opts?.onRequest?.(context);
        }
      }).catch((error) => {
        value.set({
          error,
          data: null,
          isPending: false,
          isRefetching: false,
          refetch: value.value.refetch
        });
      }).finally(() => {
        resolve(void 0);
      });
    });
  };
  initializedAtom = Array.isArray(initializedAtom) ? initializedAtom : [initializedAtom];
  let isMounted = false;
  for (const initAtom of initializedAtom) initAtom.subscribe(async () => {
    if (isServer()) return;
    if (isMounted) await fn();
    else onMount(value, () => {
      const timeoutId = setTimeout(async () => {
        if (!isMounted) {
          await fn();
          isMounted = true;
        }
      }, 0);
      return () => {
        value.off();
        initAtom.off();
        clearTimeout(timeoutId);
      };
    });
  });
  return value;
};
const kBroadcastChannel = Symbol.for("better-auth:broadcast-channel");
const now$1 = () => Math.floor(Date.now() / 1e3);
var WindowBroadcastChannel = class {
  listeners = /* @__PURE__ */ new Set();
  name;
  constructor(name = "better-auth.message") {
    this.name = name;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  post(message) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.name, JSON.stringify({
        ...message,
        timestamp: now$1()
      }));
    } catch {
    }
  }
  setup() {
    if (typeof window === "undefined" || typeof window.addEventListener === "undefined") return () => {
    };
    const handler2 = (event) => {
      if (event.key !== this.name) return;
      const message = JSON.parse(event.newValue ?? "{}");
      if (message?.event !== "session" || !message?.data) return;
      this.listeners.forEach((listener) => listener(message));
    };
    window.addEventListener("storage", handler2);
    return () => {
      window.removeEventListener("storage", handler2);
    };
  }
};
function getGlobalBroadcastChannel(name = "better-auth.message") {
  if (!globalThis[kBroadcastChannel]) globalThis[kBroadcastChannel] = new WindowBroadcastChannel(name);
  return globalThis[kBroadcastChannel];
}
const kFocusManager = Symbol.for("better-auth:focus-manager");
var WindowFocusManager = class {
  listeners = /* @__PURE__ */ new Set();
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  setFocused(focused) {
    this.listeners.forEach((listener) => listener(focused));
  }
  setup() {
    if (typeof window === "undefined" || typeof document === "undefined" || typeof window.addEventListener === "undefined") return () => {
    };
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") this.setFocused(true);
    };
    document.addEventListener("visibilitychange", visibilityHandler, false);
    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler, false);
    };
  }
};
function getGlobalFocusManager() {
  if (!globalThis[kFocusManager]) globalThis[kFocusManager] = new WindowFocusManager();
  return globalThis[kFocusManager];
}
const kOnlineManager = Symbol.for("better-auth:online-manager");
var WindowOnlineManager = class {
  listeners = /* @__PURE__ */ new Set();
  isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  setOnline(online) {
    this.isOnline = online;
    this.listeners.forEach((listener) => listener(online));
  }
  setup() {
    if (typeof window === "undefined" || typeof window.addEventListener === "undefined") return () => {
    };
    const onOnline = () => this.setOnline(true);
    const onOffline = () => this.setOnline(false);
    window.addEventListener("online", onOnline, false);
    window.addEventListener("offline", onOffline, false);
    return () => {
      window.removeEventListener("online", onOnline, false);
      window.removeEventListener("offline", onOffline, false);
    };
  }
};
function getGlobalOnlineManager() {
  if (!globalThis[kOnlineManager]) globalThis[kOnlineManager] = new WindowOnlineManager();
  return globalThis[kOnlineManager];
}
const now = () => Math.floor(Date.now() / 1e3);
const FOCUS_REFETCH_RATE_LIMIT_SECONDS = 5;
function createSessionRefreshManager(opts) {
  const { sessionAtom, sessionSignal, $fetch, options = {} } = opts;
  const refetchInterval = options.sessionOptions?.refetchInterval ?? 0;
  const refetchOnWindowFocus = options.sessionOptions?.refetchOnWindowFocus ?? true;
  const refetchWhenOffline = options.sessionOptions?.refetchWhenOffline ?? false;
  const state = {
    lastSync: 0,
    lastSessionRequest: 0,
    cachedSession: void 0
  };
  const shouldRefetch = () => {
    return refetchWhenOffline || getGlobalOnlineManager().isOnline;
  };
  const triggerRefetch = (event) => {
    if (!shouldRefetch()) return;
    if (event?.event === "storage") {
      state.lastSync = now();
      sessionSignal.set(!sessionSignal.get());
      return;
    }
    const currentSession = sessionAtom.get();
    if (event?.event === "poll") {
      state.lastSessionRequest = now();
      $fetch("/get-session").then((res) => {
        if (res.error) sessionAtom.set({
          ...currentSession,
          data: null,
          error: res.error
        });
        else sessionAtom.set({
          ...currentSession,
          data: res.data,
          error: null
        });
        state.lastSync = now();
        sessionSignal.set(!sessionSignal.get());
      }).catch(() => {
      });
      return;
    }
    if (event?.event === "visibilitychange") {
      if (now() - state.lastSessionRequest < FOCUS_REFETCH_RATE_LIMIT_SECONDS) return;
      state.lastSessionRequest = now();
    }
    if (currentSession?.data === null || currentSession?.data === void 0 || event?.event === "visibilitychange") {
      state.lastSync = now();
      sessionSignal.set(!sessionSignal.get());
    }
  };
  const broadcastSessionUpdate = (trigger) => {
    getGlobalBroadcastChannel().post({
      event: "session",
      data: { trigger },
      clientId: Math.random().toString(36).substring(7)
    });
  };
  const setupPolling = () => {
    if (refetchInterval && refetchInterval > 0) state.pollInterval = setInterval(() => {
      if (sessionAtom.get()?.data) triggerRefetch({ event: "poll" });
    }, refetchInterval * 1e3);
  };
  const setupBroadcast = () => {
    state.unsubscribeBroadcast = getGlobalBroadcastChannel().subscribe(() => {
      triggerRefetch({ event: "storage" });
    });
  };
  const setupFocusRefetch = () => {
    if (!refetchOnWindowFocus) return;
    state.unsubscribeFocus = getGlobalFocusManager().subscribe(() => {
      triggerRefetch({ event: "visibilitychange" });
    });
  };
  const setupOnlineRefetch = () => {
    state.unsubscribeOnline = getGlobalOnlineManager().subscribe((online) => {
      if (online) triggerRefetch({ event: "visibilitychange" });
    });
  };
  const init = () => {
    setupPolling();
    setupBroadcast();
    setupFocusRefetch();
    setupOnlineRefetch();
    getGlobalBroadcastChannel().setup();
    getGlobalFocusManager().setup();
    getGlobalOnlineManager().setup();
  };
  const cleanup = () => {
    if (state.pollInterval) {
      clearInterval(state.pollInterval);
      state.pollInterval = void 0;
    }
    if (state.unsubscribeBroadcast) {
      state.unsubscribeBroadcast();
      state.unsubscribeBroadcast = void 0;
    }
    if (state.unsubscribeFocus) {
      state.unsubscribeFocus();
      state.unsubscribeFocus = void 0;
    }
    if (state.unsubscribeOnline) {
      state.unsubscribeOnline();
      state.unsubscribeOnline = void 0;
    }
    state.lastSync = 0;
    state.lastSessionRequest = 0;
    state.cachedSession = void 0;
  };
  return {
    init,
    cleanup,
    triggerRefetch,
    broadcastSessionUpdate
  };
}
function getSessionAtom($fetch, options) {
  const $signal = /* @__PURE__ */ atom(false);
  const session = useAuthQuery($signal, "/get-session", $fetch, { method: "GET" });
  onMount(session, () => {
    const refreshManager = createSessionRefreshManager({
      sessionAtom: session,
      sessionSignal: $signal,
      $fetch,
      options
    });
    refreshManager.init();
    return () => {
      refreshManager.cleanup();
    };
  });
  return {
    session,
    $sessionSignal: $signal
  };
}
const getClientConfig = (options, loadEnv) => {
  const isCredentialsSupported = "credentials" in Request.prototype;
  const baseURL = getBaseURL(options?.baseURL, options?.basePath, void 0) ?? "/api/auth";
  const pluginsFetchPlugins = options?.plugins?.flatMap((plugin) => plugin.fetchPlugins).filter((pl) => pl !== void 0) || [];
  const lifeCyclePlugin = {
    id: "lifecycle-hooks",
    name: "lifecycle-hooks",
    hooks: {
      onSuccess: options?.fetchOptions?.onSuccess,
      onError: options?.fetchOptions?.onError,
      onRequest: options?.fetchOptions?.onRequest,
      onResponse: options?.fetchOptions?.onResponse
    }
  };
  const { onSuccess: _onSuccess, onError: _onError, onRequest: _onRequest, onResponse: _onResponse, ...restOfFetchOptions } = options?.fetchOptions || {};
  const $fetch = createFetch({
    baseURL,
    ...isCredentialsSupported ? { credentials: "include" } : {},
    method: "GET",
    jsonParser(text) {
      if (!text) return null;
      return parseJSON(text, { strict: false });
    },
    customFetchImpl: fetch,
    ...restOfFetchOptions,
    plugins: [
      lifeCyclePlugin,
      ...restOfFetchOptions.plugins || [],
      ...options?.disableDefaultFetchPlugins ? [] : [redirectPlugin],
      ...pluginsFetchPlugins
    ]
  });
  const { $sessionSignal, session } = getSessionAtom($fetch, options);
  const plugins = options?.plugins || [];
  let pluginsActions = {};
  const pluginsAtoms = {
    $sessionSignal,
    session
  };
  const pluginPathMethods = {
    "/sign-out": "POST",
    "/revoke-sessions": "POST",
    "/revoke-other-sessions": "POST",
    "/delete-user": "POST"
  };
  const atomListeners = [{
    signal: "$sessionSignal",
    matcher(path) {
      return path === "/sign-out" || path === "/update-user" || path === "/sign-up/email" || path === "/sign-in/email" || path === "/delete-user" || path === "/verify-email" || path === "/revoke-sessions" || path === "/revoke-session" || path === "/change-email";
    }
  }];
  for (const plugin of plugins) {
    if (plugin.getAtoms) Object.assign(pluginsAtoms, plugin.getAtoms?.($fetch));
    if (plugin.pathMethods) Object.assign(pluginPathMethods, plugin.pathMethods);
    if (plugin.atomListeners) atomListeners.push(...plugin.atomListeners);
  }
  const $store = {
    notify: (signal) => {
      pluginsAtoms[signal].set(!pluginsAtoms[signal].get());
    },
    listen: (signal, listener) => {
      pluginsAtoms[signal].subscribe(listener);
    },
    atoms: pluginsAtoms
  };
  for (const plugin of plugins) if (plugin.getActions) pluginsActions = defu(plugin.getActions?.($fetch, $store, options) ?? {}, pluginsActions);
  return {
    get baseURL() {
      return baseURL;
    },
    pluginsActions,
    pluginsAtoms,
    pluginPathMethods,
    atomListeners,
    $fetch,
    $store
  };
};
function isAtom(value) {
  return typeof value === "object" && value !== null && "get" in value && typeof value.get === "function" && "lc" in value && typeof value.lc === "number";
}
function getMethod(path, knownPathMethods, args) {
  const method = knownPathMethods[path];
  const { fetchOptions, query: _query, ...body } = args || {};
  if (method) return method;
  if (fetchOptions?.method) return fetchOptions.method;
  if (body && Object.keys(body).length > 0) return "POST";
  return "GET";
}
function createDynamicPathProxy(routes, client, knownPathMethods, atoms, atomListeners) {
  function createProxy(path = []) {
    return new Proxy(function() {
    }, {
      get(_, prop) {
        if (typeof prop !== "string") return;
        if (prop === "then" || prop === "catch" || prop === "finally") return;
        const fullPath = [...path, prop];
        let current = routes;
        for (const segment of fullPath) if (current && typeof current === "object" && segment in current) current = current[segment];
        else {
          current = void 0;
          break;
        }
        if (typeof current === "function") return current;
        if (isAtom(current)) return current;
        return createProxy(fullPath);
      },
      apply: async (_, __, args) => {
        const routePath = "/" + path.map((segment) => segment.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)).join("/");
        const arg = args[0] || {};
        const fetchOptions = args[1] || {};
        const { query, fetchOptions: argFetchOptions, ...body } = arg;
        const options = {
          ...fetchOptions,
          ...argFetchOptions
        };
        const method = getMethod(routePath, knownPathMethods, arg);
        return await client(routePath, {
          ...options,
          body: method === "GET" ? void 0 : {
            ...body,
            ...options?.body || {}
          },
          query: query || options?.query,
          method,
          async onSuccess(context) {
            await options?.onSuccess?.(context);
            if (!atomListeners || options.disableSignal) return;
            const matches = atomListeners.filter((s) => s.matcher(routePath));
            if (!matches.length) return;
            const visited = /* @__PURE__ */ new Set();
            for (const match of matches) {
              const signal = atoms[match.signal];
              if (!signal) return;
              if (visited.has(match.signal)) continue;
              visited.add(match.signal);
              const val = signal.get();
              setTimeout(() => {
                signal.set(!val);
              }, 10);
            }
          }
        });
      }
    });
  }
  return createProxy();
}
function useStore(store, options = {}) {
  const snapshotRef = useRef(store.get());
  const { keys, deps = [store, keys] } = options;
  const subscribe = useCallback((onChange) => {
    const emitChange = (value) => {
      if (snapshotRef.current === value) return;
      snapshotRef.current = value;
      onChange();
    };
    emitChange(store.value);
    if (keys?.length) return listenKeys(store, keys, emitChange);
    return store.listen(emitChange);
  }, deps);
  const get = () => snapshotRef.current;
  return useSyncExternalStore(subscribe, get, get);
}
function getAtomKey(str) {
  return `use${capitalizeFirstLetter(str)}`;
}
function createAuthClient(options) {
  const { pluginPathMethods, pluginsActions, pluginsAtoms, $fetch, $store, atomListeners } = getClientConfig(options);
  const resolvedHooks = {};
  for (const [key, value] of Object.entries(pluginsAtoms)) resolvedHooks[getAtomKey(key)] = () => useStore(value);
  return createDynamicPathProxy({
    ...pluginsActions,
    ...resolvedHooks,
    $fetch,
    $store
  }, $fetch, pluginPathMethods, pluginsAtoms, atomListeners);
}
const usernameClient = () => {
  return {
    id: "username",
    $InferServerPlugin: {},
    atomListeners: [{
      matcher: (path) => path === "/sign-in/username",
      signal: "$sessionSignal"
    }]
  };
};
const { getSession, useSession, signIn, signOut, signUp } = createAuthClient({
  plugins: [usernameClient()],
  redirectTo: "/"
});
const authClient = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getSession,
  signIn,
  signOut,
  signUp,
  useSession
}, Symbol.toStringTag, { value: "Module" }));
const Route$6 = createFileRoute("/logout")({
  preload: false,
  loader: () => signOut()
});
const Route$5 = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    if (!context?.user) {
      throw redirect({
        to: "/"
      });
    }
  }
});
const $$splitComponentImporter = () => import("./index-uk7fVAQ2.js");
const Route$4 = createFileRoute("/")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const Route$3 = createFileRoute("/_authed/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  }
});
const handler = ({ request }) => fetchRequestHandler({
  router: appRouter,
  req: request,
  endpoint: "/api/trpc",
  createContext: createTRPCContext
});
const Route$2 = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler
    }
  }
});
function toDate(value) {
  if (typeof value === "number") return new Date(value * 1e3);
  if (typeof value === "string") return new Date(value);
  return /* @__PURE__ */ new Date();
}
const Route$1 = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { stripe } = await import("./stripe-CqQ-SJqY.js");
        const { prismaClient: prismaClient2 } = await import("./prisma-CDBmz4-v.js");
        const body = await request.text();
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response(
            JSON.stringify({ error: "Missing signature" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        let event;
        try {
          event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.NODE_ENV === "production" ? process.env.STRIPE_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_TEST_SECRET
          );
        } catch (err) {
          console.error("Webhook signature verification failed:", err);
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        console.log("[Stripe Webhook] Received event:", event.type);
        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              const userId = session.metadata?.userId;
              const stripeCustomerId = session.customer;
              const stripeSubscriptionId = session.subscription;
              console.log("[Stripe Webhook] checkout.session.completed:", {
                userId,
                stripeCustomerId,
                stripeSubscriptionId,
                metadata: session.metadata
              });
              if (!userId || !stripeSubscriptionId) {
                console.warn("[Stripe Webhook] Missing userId or subscriptionId, skipping");
                break;
              }
              const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
              const item = subscription.items.data[0];
              const periodStart = toDate(item?.current_period_start);
              const periodEnd = toDate(item?.current_period_end);
              await prismaClient2.subscription.upsert({
                where: { userId },
                create: {
                  userId,
                  stripeCustomerId,
                  stripeSubscriptionId,
                  stripePriceId: item?.price.id,
                  status: "ACTIVE",
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd
                },
                update: {
                  stripeCustomerId,
                  stripeSubscriptionId,
                  stripePriceId: item?.price.id,
                  status: "ACTIVE",
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd
                }
              });
              await prismaClient2.user.update({
                where: { id: userId },
                data: { isPremium: true }
              });
              break;
            }
            case "customer.subscription.updated": {
              const subscription = event.data.object;
              const sub = await prismaClient2.subscription.findUnique({
                where: { stripeSubscriptionId: subscription.id }
              });
              if (!sub) break;
              const statusMap = {
                active: "ACTIVE",
                past_due: "PAST_DUE",
                canceled: "CANCELED",
                unpaid: "UNPAID",
                incomplete: "INCOMPLETE",
                incomplete_expired: "INCOMPLETE_EXPIRED",
                paused: "PAUSED"
              };
              const newStatus = statusMap[subscription.status] || "ACTIVE";
              const isActive = subscription.status === "active" || subscription.status === "trialing";
              const subItem = subscription.items.data[0];
              await prismaClient2.subscription.update({
                where: { stripeSubscriptionId: subscription.id },
                data: {
                  status: newStatus,
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  currentPeriodStart: toDate(subItem?.current_period_start),
                  currentPeriodEnd: toDate(subItem?.current_period_end)
                }
              });
              const user = await prismaClient2.user.findUnique({
                where: { id: sub.userId },
                select: { premiumGranted: true, premiumExpiresAt: true }
              });
              if (!user?.premiumGranted && (!user?.premiumExpiresAt || user.premiumExpiresAt < /* @__PURE__ */ new Date())) {
                await prismaClient2.user.update({
                  where: { id: sub.userId },
                  data: { isPremium: isActive }
                });
              }
              break;
            }
            case "customer.subscription.deleted": {
              const subscription = event.data.object;
              const sub = await prismaClient2.subscription.findUnique({
                where: { stripeSubscriptionId: subscription.id }
              });
              if (!sub) break;
              await prismaClient2.subscription.update({
                where: { stripeSubscriptionId: subscription.id },
                data: { status: "CANCELED" }
              });
              const user = await prismaClient2.user.findUnique({
                where: { id: sub.userId },
                select: { premiumGranted: true, premiumExpiresAt: true }
              });
              if (!user?.premiumGranted && (!user?.premiumExpiresAt || user.premiumExpiresAt < /* @__PURE__ */ new Date())) {
                await prismaClient2.user.update({
                  where: { id: sub.userId },
                  data: { isPremium: false }
                });
              }
              break;
            }
            case "invoice.payment_failed": {
              const invoice = event.data.object;
              console.warn(
                `[Stripe] Payment failed for customer ${invoice.customer}, invoice ${invoice.id}`
              );
              break;
            }
          }
        } catch (err) {
          console.error("Webhook event processing error:", err);
          return new Response(
            JSON.stringify({ error: "Event processing failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function sanitizeWord(word) {
  return removeAccents(word.trim().toLowerCase()).replace(/[^a-z0-9]/g, "").trim();
}
let lookupSetsPromise = null;
async function getLookupSets() {
  if (!lookupSetsPromise) {
    lookupSetsPromise = (async () => {
      const [blacklistMod, whitelistMod] = await Promise.all([
        import("./blacklist-wIyI54V5.js"),
        import("./optimized-whitelist-dir34ETr.js")
      ]);
      const blacklist = blacklistMod.default;
      const optimizedWhitelist = whitelistMod.default;
      return {
        blacklistSet: new Set(blacklist.map(sanitizeWord)),
        optimizedWhitelistSet: new Set(optimizedWhitelist.map(sanitizeWord))
      };
    })();
  }
  return lookupSetsPromise;
}
async function validateUsernameAgainstBlacklist(username) {
  const { blacklistSet, optimizedWhitelistSet } = await getLookupSets();
  const sanitizedUsername = sanitizeWord(username);
  for (const blacklistTerm of blacklistSet) {
    if (sanitizedUsername.includes(blacklistTerm)) {
      if (optimizedWhitelistSet.has(sanitizedUsername)) {
        continue;
      }
      let hasWhitelistSubstring = false;
      for (const whitelistWord of optimizedWhitelistSet) {
        if (whitelistWord.includes(blacklistTerm) && sanitizedUsername.includes(whitelistWord)) {
          hasWhitelistSubstring = true;
          break;
        }
      }
      if (hasWhitelistSubstring) {
        continue;
      }
      return "Username contains inappropriate content.";
    }
  }
  return void 0;
}
function jsonResponse(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra }
  });
}
function customizeRateLimitResponse(response, request) {
  const url = new URL(request.url);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  console.warn(
    `[Rate Limit] 429 Too Many Requests - Path: ${url.pathname}, IP: ${ip}`
  );
  const retryAfter = response.headers.get("Retry-After") || response.headers.get("X-Retry-After") || "60";
  const retryAfterNum = parseInt(retryAfter, 10);
  return new Response(
    JSON.stringify({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Please try again later.",
      retryAfter: retryAfterNum
    }),
    {
      status: 429,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "Content-Type": "application/json",
        "Retry-After": retryAfter
      }
    }
  );
}
async function validateRequestSize(request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 100 * 1024) {
    return jsonResponse(
      { code: "REQUEST_TOO_LARGE", message: "Request too large" },
      413
    );
  }
  return null;
}
async function validateContentType(request) {
  const contentType = request.headers.get("content-type");
  if (contentType && !contentType.includes("application/json") && !contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    return jsonResponse(
      { code: "UNSUPPORTED_CONTENT_TYPE", message: "Unsupported content type" },
      415
    );
  }
  return null;
}
const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sizeValidationResponse = await validateRequestSize(request);
        if (sizeValidationResponse) {
          return sizeValidationResponse;
        }
        try {
          const response = await auth.handler(request);
          if (response.status === 429) {
            return customizeRateLimitResponse(response, request);
          }
          return response;
        } catch (error) {
          console.error("Auth handler error:", error);
          return jsonResponse(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            500
          );
        }
      },
      POST: async ({ request }) => {
        const sizeValidationResponse = await validateRequestSize(request);
        if (sizeValidationResponse) {
          return sizeValidationResponse;
        }
        const contentTypeValidationResponse = await validateContentType(request);
        if (contentTypeValidationResponse) {
          return contentTypeValidationResponse;
        }
        const url = new URL(request.url);
        const isSignupRequest = url.pathname.includes("/sign-up/email");
        if (isSignupRequest) {
          const body = await request.clone().json();
          const errors = [];
          const schemaResult = safeParse(SignupSchema, body, {
            abortEarly: false
          });
          if (!schemaResult.success) {
            schemaResult.issues.forEach((issue) => {
              const fieldPath = issue.path?.map((p) => p.key).join(".") || "unknown";
              errors.push({
                code: `INVALID_${fieldPath.toUpperCase()}`,
                message: `${fieldPath}: ${issue.message}`
              });
            });
          }
          const username = body?.username;
          if (username && typeof username === "string") {
            const blacklistError = await validateUsernameAgainstBlacklist(username);
            if (blacklistError) {
              errors.push({
                code: "INAPPROPRIATE_USERNAME",
                message: `username: ${blacklistError}`
              });
            }
          }
          if (errors.length > 0) {
            return jsonResponse(
              {
                code: errors.length > 1 ? "MULTIPLE_VALIDATION_ERRORS" : errors[0].code,
                message: errors.length > 1 ? errors.map((e) => e.message).join(". ") : errors[0].message
              },
              400
            );
          }
        }
        try {
          let signupEmail = null;
          if (isSignupRequest) {
            try {
              const body = await request.clone().json();
              signupEmail = body?.email || null;
            } catch {
            }
          }
          const response = await auth.handler(request);
          if (response.status === 429) {
            return customizeRateLimitResponse(response, request);
          }
          if (isSignupRequest && response.status >= 400 && response.status < 500) {
            const cloned = response.clone();
            try {
              const body = await cloned.json();
              const enumerationCodes = /* @__PURE__ */ new Set([
                "USER_ALREADY_EXISTS",
                "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
                "USERNAME_IS_ALREADY_TAKEN"
              ]);
              if (body?.code && enumerationCodes.has(body.code)) {
                return jsonResponse(
                  {
                    code: "ACCOUNT_ALREADY_EXISTS",
                    message: "An account with this email or username already exists."
                  },
                  409
                );
              }
            } catch {
            }
          }
          if (isSignupRequest && response.status === 200 && signupEmail) {
            const storageKey2 = "_preferred-theme";
            const cookieHeader = request.headers.get("cookie") || "";
            const cookieMatch = cookieHeader.match(
              new RegExp(`(?:^|; )${storageKey2}=([^;]*)`)
            );
            const themeFromCookie = cookieMatch?.[1] || "light";
            prismaClient.user.findUnique({
              where: { email: signupEmail },
              select: { id: true }
            }).then((user) => {
              if (user) {
                return prismaClient.settings.upsert({
                  where: { userId: user.id },
                  create: {
                    userId: user.id,
                    theme: themeFromCookie === "dark" ? "dark" : "light"
                  },
                  update: {
                    theme: themeFromCookie === "dark" ? "dark" : "light"
                  }
                });
              }
            }).catch((error) => {
              console.error(
                `Failed to create settings for user ${signupEmail}:`,
                error
              );
            });
            sendVerificationEmail(signupEmail).catch((error) => {
              console.error(
                `Failed to send verification email to ${signupEmail}:`,
                error
              );
            });
            const inviteMatch = cookieHeader.match(
              /(?:^|; )_invite-token=([^;]*)/
            );
            const inviteToken = inviteMatch?.[1];
            if (inviteToken) {
              prismaClient.user.findUnique({
                where: { email: signupEmail },
                select: { id: true }
              }).then(async (user) => {
                if (!user) return;
                const invite = await prismaClient.invite.findUnique({
                  where: { token: inviteToken }
                });
                if (!invite || invite.consumed) return;
                await prismaClient.$transaction([
                  prismaClient.user.update({
                    where: { id: user.id },
                    data: { isPremium: true, premiumGranted: true }
                  }),
                  prismaClient.invite.update({
                    where: { id: invite.id },
                    data: { consumed: true, consumedBy: user.id }
                  })
                ]);
                console.log(
                  `Invite token consumed: user ${user.id} granted lifetime premium`
                );
              }).catch((error) => {
                console.error(
                  `Failed to process invite token for ${signupEmail}:`,
                  error
                );
              });
            }
          }
          return response;
        } catch (error) {
          console.error("Auth handler error:", error);
          return jsonResponse(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            500
          );
        }
      }
    }
  }
});
const VerifyEmailRoute = Route$9.update({
  id: "/verify-email",
  path: "/verify-email",
  getParentRoute: () => Route$a
});
const SignupRoute = Route$8.update({
  id: "/signup",
  path: "/signup",
  getParentRoute: () => Route$a
});
const SigninRoute = Route$7.update({
  id: "/signin",
  path: "/signin",
  getParentRoute: () => Route$a
});
const LogoutRoute = Route$6.update({
  id: "/logout",
  path: "/logout",
  getParentRoute: () => Route$a
});
const AuthedRoute = Route$5.update({
  id: "/_authed",
  getParentRoute: () => Route$a
});
const IndexRoute = Route$4.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$a
});
const AuthedDashboardRoute = Route$3.update({
  id: "/dashboard",
  path: "/dashboard",
  getParentRoute: () => AuthedRoute
});
const ApiTrpcSplatRoute = Route$2.update({
  id: "/api/trpc/$",
  path: "/api/trpc/$",
  getParentRoute: () => Route$a
});
const ApiStripeWebhookRoute = Route$1.update({
  id: "/api/stripe/webhook",
  path: "/api/stripe/webhook",
  getParentRoute: () => Route$a
});
const ApiAuthSplatRoute = Route.update({
  id: "/api/auth/$",
  path: "/api/auth/$",
  getParentRoute: () => Route$a
});
const AuthedRouteChildren = {
  AuthedDashboardRoute
};
const AuthedRouteWithChildren = AuthedRoute._addFileChildren(AuthedRouteChildren);
const rootRouteChildren = {
  IndexRoute,
  AuthedRoute: AuthedRouteWithChildren,
  LogoutRoute,
  SigninRoute,
  SignupRoute,
  VerifyEmailRoute,
  ApiAuthSplatRoute,
  ApiStripeWebhookRoute,
  ApiTrpcSplatRoute
};
const routeTree = Route$a._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  const router2 = createRouter({
    routeTree,
    defaultPreload: false,
    // Disable preloading to prevent root route loader from running on hover
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
    scrollRestoration: true
  });
  return router2;
}
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  Dialog as D,
  Route$9 as R,
  Route$8 as a,
  signIn as b,
  submitGuessServerFn as c,
  Route$4 as d,
  getUserStatsServerFn as g,
  router as r,
  signUp as s,
  useGameStore as u
};
