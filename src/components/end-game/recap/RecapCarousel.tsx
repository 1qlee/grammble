import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  FinishInfo,
  GramBar,
  GramSlide,
  GuessSlide,
  NoteItem,
  OverviewSlide,
  PathStep,
  RecapSlide,
} from "./useGameRecap";
import type { NoteCell } from "~/utils/game/note-tiles";
import { OverviewScorePanel } from "./OverviewScorePanel";
import { FortunePanel } from "./FortunePanel";
import { RecapBoard } from "./RecapBoard";
import { RecapIntroProvider } from "./useRecapAnimations";
import { Odometer } from "../stats/Odometer";
import { GramFace } from "~/components/guesses/GramFace";
import { useGameStore } from "~/stores/game-store";
import { useSettings } from "~/utils/providers/settings-provider";
import Button from "~/components/buttons/Button";

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// The padded, bordered panel every recap section sits in, matching the overview slide's score and
// fortune cards, so a section reads as one card whichever slide it lives on.
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

function deltaTone(n: number): string {
  if (n > 0) return "text-green-600 dark:text-green-400";
  if (n < 0) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-500 dark:text-zinc-400";
}

// The running score for a slide, ticking from its value on the previous slide up (or down) by this
// slide's net change, with an itemized breakdown of what moved it beneath. The number animates on
// every arrival so the total visibly moves as the player walks the recap.
function ScoreSection({
  label,
  notesLabel,
  before,
  after,
  notes,
  onTilesChange,
}: {
  label: string;
  notesLabel: string;
  before: number;
  after: number;
  notes: NoteItem[];
  // Called with the board cells of the note the player is hovering or has tapped (null when none), so
  // the parent slide can highlight the matching tiles on its recap board.
  onTilesChange?: (tiles: NoteCell[] | null) => void;
}) {
  const delta = Math.round(after) - Math.round(before);
  return (
    <SectionCard>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="section-label">{label}</span>
          <span className="flex items-baseline gap-2 leading-none">
            <Odometer
              value={after}
              from={before}
              duration={700}
              className="text-5xl font-extrabold tabular-nums"
            />
            {delta !== 0 && (
              <span
                className={`text-base font-bold tabular-nums ${deltaTone(delta)}`}
              >
                {signed(delta)}
              </span>
            )}
          </span>
        </div>
        <ScoreNotes
          label={notesLabel}
          notes={notes}
          onTilesChange={onTilesChange}
        />
      </div>
    </SectionCard>
  );
}

// "Your Nth guess": the ordinal of the guess a slide covers (11th-13th keep -th).
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function slideHeading(slide: RecapSlide, isLast: boolean): string {
  if (slide.kind === "overview") return "Overview";
  if (slide.kind === "gram") return "Your opener";
  return isLast
    ? "Your last guess"
    : `Your ${ordinal(slide.guessNumber)} guess`;
}

// The itemized score breakdown: each line names what happened and how many points it moved, the
// label tinted green (gain) or amber (loss) and its signed value on the right. Hides when empty.
// A note that maps to board tiles (see noteTiles) is interactive: hovering it (or tapping, on touch)
// highlights those tiles on the slide's recap board via `onTilesChange`. Notes with no tiles (a
// length shortfall, a neglect omission) stay plain text.
function ScoreNotes({
  label,
  notes,
  onTilesChange,
}: {
  label: string;
  notes: NoteItem[];
  onTilesChange?: (tiles: NoteCell[] | null) => void;
}) {
  // Hover (mouse) takes priority over a sticky tap selection, so a touch tap latches the highlight
  // while a mouse can preview others without losing it. `active` is the effective note index.
  const [hovered, setHovered] = useState<number | null>(null);
  const [sticky, setSticky] = useState<number | null>(null);
  const active = hovered ?? sticky;

  const emit = onTilesChange;
  useEffect(() => {
    if (!emit) return;
    const note = active != null ? notes[active] : undefined;
    emit(note && note.tiles.length > 0 ? note.tiles : null);
  }, [active, notes, emit]);

  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="section-label">{label}</span>
      <ul className="flex flex-col gap-1">
        {notes.map((note, i) => {
          const interactive = note.tiles.length > 0;
          const toggleSticky = () => setSticky((s) => (s === i ? null : i));
          return (
            <li
              key={i}
              // Keyboard focus mirrors mouse hover: focusing an item previews its tile highlight,
              // Enter/Space toggles the sticky selection just like a tap. Non-interactive notes
              // (no tiles) stay plain text and out of the tab order.
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-pressed={interactive ? sticky === i : undefined}
              onPointerEnter={
                interactive ? () => setHovered(i) : undefined
              }
              onPointerLeave={
                interactive
                  ? () => setHovered((h) => (h === i ? null : h))
                  : undefined
              }
              onFocus={interactive ? () => setHovered(i) : undefined}
              onBlur={
                interactive
                  ? () => setHovered((h) => (h === i ? null : h))
                  : undefined
              }
              onClick={interactive ? toggleSticky : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSticky();
                      }
                    }
                  : undefined
              }
              className={clsx(
                "-mx-1.5 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm leading-snug transition-colors",
                interactive &&
                  "cursor-pointer border border-zinc-200 dark:border-zinc-800",
                active === i && "bg-zinc-100 dark:bg-zinc-800"
              )}
            >
              <span className={deltaTone(note.points)}>{note.label}</span>
              <span className="shrink-0 tabular-nums">
                {note.percent != null ? (
                  // A graded-opener line reads as its criterion percentage, not a raw point delta.
                  <span className={`font-bold ${deltaTone(note.points)}`}>
                    {note.percent}
                  </span>
                ) : (
                  <>
                    <span className={`font-bold ${deltaTone(note.points)}`}>
                      {signed(note.points)}
                    </span>
                    {note.max != null && (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {" "}
                        / {note.max}
                      </span>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OverviewBody({ slide }: { slide: OverviewSlide }) {
  return (
    <div className="flex flex-col gap-2">
      <OverviewScorePanel
        score={slide.score}
        base={slide.base}
        baseLines={slide.baseLines}
        opening={slide.opening}
        openingLines={slide.openingLines}
        skill={slide.skill}
        contributions={slide.contributions}
        guessCount={slide.guessCount}
      />
      <FortunePanel luck={slide.fortune} />
    </div>
  );
}

// A row of real game tiles: the two-letter gram tile dropped into its candidate slot. Non-gram
// slots are blank wells for hypothetical placements, or the player's actual letters when `word` is
// given (the row for the guess they played). Tiles are scaled down via a local `--tile-size`
// override so the same GramFace / `.tile-blank` visuals render at recap size. The most probable
// placement(s) are tinted green; every other slot stays the default tile face.
function GramTileRow({
  bar,
  isTop,
  word,
}: {
  bar: GramBar;
  isTop: boolean;
  word?: string;
}) {
  const feedback = isTop ? "correct" : undefined;
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < bar.wordLength; i++) {
    if (i === bar.position) {
      cells.push(
        <span
          key={i}
          className="block shrink-0"
          style={{
            width: "calc(var(--tile-size) * 2 + var(--tile-gap))",
            height: "var(--tile-size)",
          }}
        >
          <GramFace
            chars={[bar.gram[0] ?? "", bar.gram[1] ?? ""]}
            feedback={feedback}
          />
        </span>
      );
      i += bar.gram.length - 1; // the wide gram tile spans its remaining slots
    } else if (word) {
      cells.push(
        <span
          key={i}
          className="tile pointer-events-none shrink-0"
        >
          <span className="tile-char">{word[i] ?? ""}</span>
        </span>
      );
    } else {
      cells.push(
        <span
          key={i}
          className="tile tile-blank pointer-events-none shrink-0"
        />
      );
    }
  }
  return (
    <span
      className="flex shrink-0 items-center uppercase"
      style={
        {
          "--tile-size": "18px",
          "--tile-gap": "2px",
          "--tile-font-size": "calc(var(--tile-size) * 0.5)",
          gap: "var(--tile-gap)",
          fontSize: "calc(var(--tile-size) * 0.5)",
        } as CSSProperties
      }
    >
      {cells}
    </span>
  );
}

// The gram's candidate placement: a row of real tiles showing where the gram could sit, next to a
// bar sized to how often the gram sits there. Track and fill mirror the distribution chart on the
// results screen: the most probable placement(s) fill green, every other placement a muted zinc.
// The player's own placement is marked by its filled letters, not the bar color.
function GramBarRow({
  bar,
  isTop,
  word,
}: {
  bar: GramBar;
  isTop: boolean;
  word?: string;
}) {
  const { colorBlindMode } = useSettings();
  // Mirror the distribution chart: the most-probable placement fills with the
  // "correct" color, swapped to the high-contrast orange in color-blind mode.
  const topFill = colorBlindMode
    ? "bg-[#f5793a] dark:bg-[#f5793a]"
    : "bg-green-300 dark:bg-green-600";
  const fill = isTop ? topFill : "bg-zinc-300 dark:bg-zinc-700";
  return (
    <div className="flex items-center gap-2 text-xs">
      <GramTileRow
        bar={bar}
        isTop={isTop}
        word={word}
      />
      <span className="h-4 flex-1 rounded-sm border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
        <span
          className={`block h-full rounded-sm transition-[width] duration-500 ease-[cubic-bezier(.2,.7,.3,1)] ${fill}`}
          style={{ width: `${bar.pct}%` }}
        />
      </span>
      <span className="text-accent w-9 shrink-0 text-right tabular-nums">
        {Math.round(bar.fraction * 100)}%
      </span>
    </div>
  );
}

// The opener slide: the board, the Opening credit it earned, and the odds behind where its gram
// could have sat.
function GramBody({ slide }: { slide: GramSlide }) {
  // The most probable placement(s): every bar whose share ties the maximum (a genuine tie tints
  // them all green). Zero-share slots never qualify, even when every placement is impossible.
  const maxFraction = Math.max(0, ...slide.bars.map((b) => b.fraction));
  const isTop = (bar: GramBar) =>
    bar.fraction > 0 && maxFraction - bar.fraction < 1e-9;
  const [tiles, setTiles] = useState<NoteCell[] | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <RecapBoard
        revealCount={slide.guessNumber}
        highlight={tiles}
      />
      <ScoreSection
        label="Opener score"
        notesLabel="What earned the score"
        before={slide.scoreBefore}
        after={slide.scoreAfter}
        notes={slide.notes}
        onTilesChange={setTiles}
      />
      <SectionCard>
        <div className="flex flex-col gap-2">
          <p className="section-label">Likely gram positions</p>
          <div className="flex flex-col gap-1.5">
            {slide.bars.map((bar, i) => (
              <GramBarRow
                key={i}
                bar={bar}
                isTop={isTop(bar)}
                word={bar.isChosen ? slide.guess : undefined}
              />
            ))}
          </div>
        </div>
      </SectionCard>
      <RemainingWords
        before={slide.before}
        after={slide.after}
        answers={slide.answers}
        answerTotal={slide.answerTotal}
        probes={slide.probes}
        otherWords={slide.otherWords}
        opener
      />
    </div>
  );
}

// One survivor word rendered as a chip with its gram substring highlighted against the muted rest,
// so the player can see where the day's gram sits inside every still-valid word.
function WordChip({ word, gram }: { word: string; gram: string }) {
  const upper = word.toUpperCase();
  const g = gram.toUpperCase();
  const idx = g ? upper.indexOf(g) : -1;
  const rest = "text-zinc-900 dark:text-zinc-100";
  const gramColor = "font-bold text-green-600 dark:text-green-400";
  return (
    <span className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-900">
      {idx < 0 ? (
        <span className={rest}>{upper}</span>
      ) : (
        <>
          <span className={rest}>{upper.slice(0, idx)}</span>
          <span className={gramColor}>{upper.slice(idx, idx + g.length)}</span>
          <span className={rest}>{upper.slice(idx + g.length)}</span>
        </>
      )}
    </span>
  );
}

// A sub-section heading: the label, a rule that runs to the far edge, and the count of words in the
// group sitting at the end of that rule.
function GroupHeading({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="section-label whitespace-nowrap">{label}</span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {count != null && (
        <span className="text-xs font-medium tabular-nums text-zinc-400 dark:text-zinc-500">
          {count}
        </span>
      )}
    </div>
  );
}

// The still-valid field after a guess: the survivor count as a headline and how far it fell, then
// the likely answers (answer-length words) as gram-highlighted chips, and a sub-section of the
// sharpest shorter guesses left to narrow further. Once the field is down to one, that lone survivor
// is the answer itself: the section says so plainly (the game is already over) and, since there are
// no narrowing probes left, offers a sample of other valid gram words as playable inspiration.
function RemainingWords({
  before,
  after,
  answers,
  answerTotal,
  probes,
  otherWords,
  opener = false,
}: {
  before: number;
  after: number;
  answers: string[];
  answerTotal: number;
  probes: string[];
  otherWords: string[];
  opener?: boolean;
}) {
  const gram = useGameStore((s) => s.gram);
  const single = after <= 1;
  const more = answerTotal - answers.length;
  return (
    <SectionCard>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="section-label">Words still valid</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tabular-nums">
              {after.toLocaleString()}
            </span>
            <span className="text-sm">{single ? "word left" : "words remain"}</span>
          </div>
          {single && (
            <p className="text-accent text-xs">
              Only the hidden answer still fits the clues.
            </p>
          )}
          {before > after && (
            <p className="text-accent text-xs">
              Narrowed from{" "}
              <span className="font-semibold text-green-600 dark:text-green-400">
                {before.toLocaleString()}
              </span>{" "}
              {opener ? "possible answers" : "candidates"}
            </p>
          )}
        </div>
        {answers.length > 0 && (
          <div className="flex flex-col gap-2">
            <GroupHeading
              label={single ? "The answer" : "Possible answers"}
              count={single ? undefined : answerTotal}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {answers.map((word) => (
                <WordChip
                  key={word}
                  word={word}
                  gram={gram}
                />
              ))}
              {more > 0 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  +{more} more
                </span>
              )}
            </div>
          </div>
        )}
        {probes.length > 0 && (
          <div className="flex flex-col gap-2">
            <GroupHeading
              label="Best next guesses"
              count={probes.length}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {probes.map((word) => (
                <WordChip
                  key={word}
                  word={word}
                  gram={gram}
                />
              ))}
            </div>
          </div>
        )}
        {single && otherWords.length > 0 && (
          <div className="flex flex-col gap-2">
            <GroupHeading label="Other valid words" />
            <p className="text-accent text-xs">
              These fit the gram but no longer match the clues, in case you were
              stuck for ideas.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {otherWords.map((word) => (
                <WordChip
                  key={word}
                  word={word}
                  gram={gram}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// The finish read for a won game: how many words the winning guess chose from, a line on whether the
// answer was deduced or a fortunate pick (finish luck), and the other words that were still standing.
function finishNote(solvedWith: number, finishBits: number): string {
  if (solvedWith <= 1)
    return "There was only one viable answer based on the state of the board.";
  if (finishBits >= 1.5)
    return `You found it among ${solvedWith} words that still fit, a fortunate finish.`;
  if (finishBits >= 0.5)
    return `${solvedWith} words still fit, so landing the answer took a sharp read.`;
  return `${solvedWith} words still fit, and you picked the answer out of them.`;
}

function FinishSection({ finish }: { finish: FinishInfo }) {
  const gram = useGameStore((s) => s.gram);
  const singular = finish.solvedWith === 1;
  return (
    <SectionCard>
      <div className="flex flex-col gap-3">
        <span className="section-label">The finish</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tabular-nums">
            {finish.solvedWith.toLocaleString()}
          </span>
          <span className="text-sm">
            {singular ? "word could fit" : "words still fit"}
          </span>
        </div>
        <p className="text-accent text-sm leading-snug">
          {finishNote(finish.solvedWith, finish.finishBits)}
        </p>
        {finish.alternatives.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="section-label">Others still in play</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {finish.alternatives.map((word) => (
                <WordChip
                  key={word}
                  word={word}
                  gram={gram}
                />
              ))}
              {finish.moreAlternatives > 0 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  +{finish.moreAlternatives} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// The whole-game narrowing path on the final slide: each guess and how far it cut the field of
// possible answers. A guess that left the count unchanged (and above one) failed to narrow, flagged
// amber in the row and called out beneath.
function PathSection({ path }: { path: PathStep[] }) {
  return (
    <SectionCard>
      <div className="flex flex-col gap-2">
        <span className="section-label">Your path</span>
        <ul className="flex flex-col gap-1.5">
          {path.map((step, i) => {
            const didStall = step.before === step.after && step.after > 1;
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="text-accent w-4 text-xs">
                    {i + 1}
                  </span>
                  <span className="uppercase">{step.guess}</span>
                </span>
                <span
                  className={`text-xs tabular-nums ${didStall
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-accent"
                    }`}
                >
                  {step.before.toLocaleString()} &rarr;{" "}
                  {step.after.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
  );
}

function GuessBody({ slide }: { slide: GuessSlide }) {
  const [tiles, setTiles] = useState<NoteCell[] | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <RecapBoard
        revealCount={slide.guessNumber}
        highlight={tiles}
      />
      <ScoreSection
        label="Score"
        notesLabel="What changed the score"
        before={slide.scoreBefore}
        after={slide.scoreAfter}
        notes={slide.notes}
        onTilesChange={setTiles}
      />
      {!slide.finish && (
        <RemainingWords
          before={slide.before}
          after={slide.after}
          answers={slide.answers}
          answerTotal={slide.answerTotal}
          probes={slide.probes}
          otherWords={slide.otherWords}
        />
      )}
      {slide.finish && <FinishSection finish={slide.finish} />}
      {slide.path && <PathSection path={slide.path} />}
    </div>
  );
}

function SlideBody({ slide }: { slide: RecapSlide }) {
  if (slide.kind === "overview") return <OverviewBody slide={slide} />;
  if (slide.kind === "gram") return <GramBody slide={slide} />;
  return <GuessBody slide={slide} />;
}

/**
 * The entire recap as one carousel: an overview verdict, the opener's gram-placement read, then a
 * slide per later guess. Navigable by the chevrons or the dots.
 */
export function RecapCarousel({ slides }: { slides: RecapSlide[] }) {
  const [index, setIndex] = useState(0);
  // Paging swaps which slide is mounted, so a slide's intro animations would re-run every time it
  // came back around. The intro belongs to opening the recap, not to arriving at a slide: it plays
  // on this first render only, and every later render hands the slides an already-spent flag.
  const introRef = useRef(true);
  const intro = introRef.current;
  useEffect(() => {
    introRef.current = false;
  }, []);
  if (slides.length === 0) return null;

  const clamped = Math.min(index, slides.length - 1);
  const slide = slides[clamped];
  const go = (next: number) =>
    setIndex(Math.max(0, Math.min(slides.length - 1, next)));

  const canGoPrev = clamped > 0;
  const canGoNext = clamped < slides.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-3">
        <RecapIntroProvider value={intro}>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold">
              {slideHeading(slide, clamped === slides.length - 1)}
            </h3>
            {/* Keyed by slide so a note's hover/tap highlight state never carries across pages. */}
            <SlideBody
              key={clamped}
              slide={slide}
            />
          </div>
        </RecapIntroProvider>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4">
        <Button
          size="icon"
          onClick={() => go(clamped - 1)}
          disabled={!canGoPrev}
          aria-label="Previous slide"
          className="disabled:opacity-30"
        >
          <ChevronLeft
            className="h-5 w-5"
            strokeWidth={2.4}
          />
        </Button>

        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === clamped
                ? "w-4 bg-zinc-700 dark:bg-zinc-200"
                : "w-2 cursor-pointer bg-zinc-300 dark:bg-zinc-600"
                }`}
            />
          ))}
        </div>

        <Button
          size="icon"
          onClick={() => go(clamped + 1)}
          disabled={!canGoNext}
          aria-label="Next slide"
          className="disabled:opacity-30"
        >
          <ChevronRight
            className="h-5 w-5"
            strokeWidth={2.4}
          />
        </Button>
      </div>
    </div>
  );
}
