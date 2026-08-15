import { cubicBezier } from "animejs";

// The keycap rising out of the slot when a letter is entered: fades in from
// 10px below, overshoots up past its resting spot, then settles back down.
// Pairs with TILE_SLOT_PUNCH on the parent .tile for a "keycap pops out of the
// well" feel. The resting surface (flat fill + border) lives on
// `.tile-char`/surface-raised in CSS, so we only tween transform + opacity here.
export const CHAR_IN = {
  opacity: [{ from: 0, to: 1, duration: 90 }],
  translateY: [
    { from: -6, to: 0, duration: 210 },
    { to: 0, duration: 90 },
  ],
  scale: [
    { from: 0.95, to: 1.02, duration: 210 },
    { to: 1, duration: 90 },
  ],
  ease: cubicBezier(0.2, 0.8, 0.3, 1.1),
};

export const CHAR_OUT = {
  translateY: 6,
  opacity: 0,
  duration: 300,
  ease: cubicBezier(0.2, 0.8, 0.3, 1.1),
};

// The slot (.tile) dips down as the keycap lands, like it's absorbing the
// press, then springs back. Runs on the parent tile the moment a char mounts,
// so it brackets CHAR_IN's rise. No brightness dip here: while the keycap is
// still rising from below at low opacity the slot is briefly exposed, and
// darkening it read as a dark flash behind the letter.
export const TILE_SLOT_PUNCH = {
  translateY: [
    { to: 2, duration: 98 },
    { to: 0, duration: 182 },
  ],
  scale: [
    { to: 0.94, duration: 98 },
    { to: 1, duration: 182 },
  ],
  ease: cubicBezier(0.3, 0.8, 0.4, 1),
};

// Submitting pop, split in two so it brackets the server round-trip: filled
// tiles scale down the moment a guess is sent (DOWN) and hold there until the
// response arrives, then snap past full size, counter under, and settle back to
// 1 (UP) as a spring curve expressed as explicit keyframes.
export const TILE_SUBMIT_DOWN = {
  scale: 0.98,
  translateY: 2,
  duration: 90,
  ease: cubicBezier(0.4, 0, 0.6, 1),
};

export const TILE_SUBMIT_UP = {
  scale: [
    { to: 1.06, duration: 90 },
    { to: 0.94, duration: 110 },
    { to: 1, duration: 100 },
  ],
  translateY: [
    { to: -2, duration: 90 },
    { to: 0, duration: 210 },
  ],
  ease: cubicBezier(0.4, 0, 0.6, 1),
};

// Win celebration: instead of the plain submit spring-back, the winning row's
// tiles fan outward like a hand of cards, then settle back to flat. The pivot
// sits below each tile (transform-origin 50% 130%) so they swing out from a
// shared base rather than spinning on center. Left tiles tilt counter-clockwise,
// right tiles clockwise, by an angle that grows linearly toward the ends, and
// the stagger radiates from the center so the middle tiles lead. Per-tile angle
// and delay are computed in GuessRow from each tile's on-screen position.
//
// Pivot below the tile, giving the fanned-cards swing.
export const FAN_ORIGIN = "50% 130%";
// Degrees of tilt per step away from center: the innermost tiles get ~FAN_ROT_DEG,
// the next ring 2x, and so on (angle = stepsFromCenter * FAN_ROT_DEG).
export const FAN_ROT_DEG = 7;
// How far tiles lift at the peak of the fan, in px (negative = up).
export const FAN_LIFT_PX = -20;
// Per-step delay as the stagger radiates out from the center tile(s).
export const FAN_STAGGER_MS = 63;
// Outward phase: tiles swing out and lift with a springy overshoot.
export const TILE_FAN_OUT_MS = 350;
export const TILE_FAN_OUT_EASE = cubicBezier(0.22, 1.5, 0.36, 1);
// Hold at the fanned-out, lifted peak before settling back. The confetti is
// timed to launch as this hold begins.
export const TILE_FAN_HOLD_MS = 500;
// Return phase: settle back to flat/rest.
export const TILE_FAN_BACK_MS = 650;
export const TILE_FAN_BACK_EASE = cubicBezier(0.25, 1, 0.4, 1);

// Initial board reveal: on load, each pre-populated (already-submitted) row
// fades and scales its keycaps in as a staggered diagonal cascade. Every
// populated keycap runs the CSS `tile-reveal` animation offset by its row
// (top-to-bottom) plus column (left-to-right) position, so rows cascade in.
// Consumed by GuessRow to compute each tile's animation-delay.
export const REVEAL_ROW_STAGGER_MS = 65;
export const REVEAL_COL_STAGGER_MS = 27.5;

// Floor on how long the "submitting" (scaled-down) state stays visible. When the
// server answers faster than this, the submit hook holds before applying the
// result so the DOWN animation finishes and the spring-back reads as deliberate
// rather than a flicker. Comfortably above TILE_SUBMIT_DOWN's 90ms duration.
export const SUBMIT_MIN_VISIBLE_MS = 200;
