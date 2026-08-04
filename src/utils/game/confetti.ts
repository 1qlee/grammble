// Dependency-free confetti. On a win we seed a handful of small flakes from the
// center of each winning tile; they rise, sway, and fade out in place rather
// than falling. One shared full-screen canvas runs a single rAF loop over a
// flat particle array, then tears itself down once every flake has faded. Kept
// off anime.js on purpose: a flat particle array under one rAF loop is cheaper
// than animating N DOM nodes and never competes with the tile timelines.

type ConfettiOptions = {
  // Inclusive range of pieces spawned per origin. Defaults to 8-16.
  minPerOrigin?: number;
  maxPerOrigin?: number;
  // Override the default celebratory palette.
  colors?: string[];
};

// Green + yellow echo the game's feedback colors; gold and white keep the burst
// from reading as "more feedback" and push it toward festive.
const DEFAULT_COLORS = [
  "#22c55e", // green-500
  "#86efac", // green-300
  "#facc15", // yellow-400
  "#fde047", // yellow-300
  "#f59e0b", // amber-500
  "#ffffff",
];

type Flake = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  // Horizontal sway: phase + frequency drive a gentle side-to-side flutter.
  swayPhase: number;
  swayFreq: number;
  swayAmp: number;
  ttl: number; // total lifetime, ms
  age: number; // elapsed lifetime, ms
};

// Gentle upward drift that bleeds off via DRAG so flakes slow and hang as they
// fade, rather than arcing back down like a fountain.
const RISE_DRAG = 0.97;
// Lifetimes run 50% longer than the original 1300/500 so flakes linger in play
// and fade out more gradually rather than vanishing quickly.
const LIFE_MS = 1950;
const LIFE_JITTER_MS = 750;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let flakes: Flake[] = [];
let rafId = 0;
let lastTs = 0;

function ensureCanvas(): boolean {
  if (canvas) return true;
  const el = document.createElement("canvas");
  el.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = window.innerWidth * dpr;
  el.height = window.innerHeight * dpr;
  const context = el.getContext("2d");
  if (!context) return false;
  context.scale(dpr, dpr);
  document.body.appendChild(el);
  canvas = el;
  ctx = context;
  return true;
}

function teardown(): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
  flakes = [];
  canvas?.remove();
  canvas = null;
  ctx = null;
  lastTs = 0;
}

function frame(now: number): void {
  if (!ctx || !canvas) return;
  if (!lastTs) lastTs = now;
  const deltaMs = now - lastTs;
  lastTs = now;
  // Normalize physics to 60fps steps so motion is refresh-rate independent.
  const dt = Math.min(deltaMs / 16.67, 2);

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  let alive = 0;
  for (const f of flakes) {
    f.age += deltaMs;
    if (f.age >= f.ttl) continue;
    alive++;

    f.vy *= RISE_DRAG;
    f.vx *= RISE_DRAG;
    f.swayPhase += f.swayFreq * dt;
    f.x += (f.vx + Math.cos(f.swayPhase) * f.swayAmp) * dt;
    f.y += f.vy * dt;
    f.rotation += f.rotationSpeed * dt;

    // Ease-out fade across the full lifetime so flakes thin gradually.
    const fade = 1 - f.age / f.ttl;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    ctx.globalAlpha = fade * fade;
    ctx.fillStyle = f.color;
    ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size);
    ctx.restore();
  }

  if (alive > 0) {
    rafId = requestAnimationFrame(frame);
  } else {
    teardown();
  }
}

/**
 * Spawn a small rising burst from the center of each given element. Safe to
 * call repeatedly; bursts share one canvas and rAF loop. No-op on the server or
 * when the user prefers reduced motion.
 */
export function fireConfettiFromElements(
  elements: Iterable<Element>,
  options: ConfettiOptions = {},
): void {
  if (typeof document === "undefined" || prefersReducedMotion()) return;

  const colors = options.colors ?? DEFAULT_COLORS;
  const min = options.minPerOrigin ?? 8;
  const max = options.maxPerOrigin ?? 16;

  const spawned: Flake[] = [];
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const cx = rect.left + rect.width / 2;
    const count = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < count; i++) {
      spawned.push({
        // Emit from along the top edge of the tile, spread across its width.
        x: cx + (Math.random() - 0.5) * rect.width * 0.8,
        y: rect.top + (Math.random() - 0.5) * rect.height * 0.12,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(2.5 + Math.random() * 3), // upward launch
        size: 3 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        color: colors[Math.floor(Math.random() * colors.length)],
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 0.08 + Math.random() * 0.08,
        swayAmp: 0.4 + Math.random() * 0.6,
        ttl: LIFE_MS + Math.random() * LIFE_JITTER_MS,
        age: 0,
      });
    }
  }

  if (spawned.length === 0) return;
  if (!ensureCanvas()) return;

  flakes.push(...spawned);
  if (!rafId) {
    lastTs = 0;
    rafId = requestAnimationFrame(frame);
  }
}
