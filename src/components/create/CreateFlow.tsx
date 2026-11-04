"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LiveCounter } from "@/components/LiveCounter";
import { MosaicSvg } from "@/components/mosaic/MosaicSvg";
import { TileCardSvg } from "@/components/mosaic/TileCardSvg";
import { TilePreview } from "@/components/mosaic/TilePreview";
import { ShareActions } from "./ShareActions";
import { useMosaicFeed } from "@/hooks/useMosaicFeed";
import { useParticipant } from "@/hooks/useParticipant";
import { ApiError, api, withRetry } from "@/lib/client/api";
import { tileLabel, TOTAL_TILES } from "@/lib/grid";
import { COLORS, MESSAGE_MAX, PROMPT, SYMBOLS, defaultMotif, getColor, type ColorId } from "@/lib/palette";
import type { OwnContribution } from "@/lib/types";
import { graphemeLength } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Step = "intro" | "color" | "symbol" | "message" | "preview" | "done";
const STEPS: Step[] = ["color", "symbol", "message", "preview"];
const DRAFT_KEY = "toronto-mosaic:draft";

interface Draft {
  color: ColorId | null;
  symbol: string | null;
  message: string;
}

export function CreateFlow() {
  const { ready, own, setOwn, error: sessionError } = useParticipant();
  const { state, tileMap, fresh } = useMosaicFeed();
  const [chosenStep, setStep] = useState<Step>("intro");
  // The intro step never renders the draft, so reading sessionStorage here can't cause a hydration mismatch.
  const [draft, setDraft] = useState<Draft>(() => {
    const empty: Draft = { color: null, symbol: null, message: "" };
    if (typeof window === "undefined") return empty;
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") ?? empty;
    } catch {
      return empty;
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Persist an unsent draft so an accidental refresh doesn't lose it.
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  // Anyone who already has a tile goes straight to it.
  const step: Step = own ? "done" : chosenStep;

  // Move focus to the step heading for screen-reader and keyboard users.
  useEffect(() => {
    if (step !== "intro") headingRef.current?.focus();
  }, [step]);

  const closed = !state.config.submissionsEnabled;
  const full = state.aggregates.remainingTiles <= 0;
  const idx = STEPS.indexOf(step);

  const submit = async () => {
    if (!draft.color || !draft.symbol) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await withRetry(() =>
        api<{ created: boolean; contribution: OwnContribution }>("/api/contributions", {
          method: "POST",
          body: JSON.stringify({ color: draft.color, symbol: draft.symbol, message: draft.message }),
        }),
      );
      setOwn(res.contribution);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      setStep("done");
    } catch (e) {
      const err = e as ApiError;
      const retry = err instanceof ApiError ? err.retryable : true;
      const friendly: Record<string, string> = {
        MOSAIC_FULL: "All 300 tiles have been claimed — the skyline is complete! You can still explore everyone's contributions.",
        SUBMISSIONS_CLOSED: "Submissions are paused for a moment. Your design is saved — try again shortly.",
        NO_SESSION: "Your session expired. Refresh the page and your design will still be here.",
      };
      setError({ message: friendly[err.code] ?? err.message, retry: retry || err.code === "SUBMISSIONS_CLOSED" });
    } finally {
      setSubmitting(false);
    }
  };

  const motif = draft.symbol ? defaultMotif(draft.symbol) : "sparkles";

  return (
    <div className="mx-auto w-full max-w-xl overflow-x-clip px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {step !== "intro" && step !== "done" && (
        <nav aria-label="Progress" className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => setStep(idx <= 0 ? "intro" : STEPS[idx - 1])}
          >
            <ArrowLeft />
          </Button>
          <ol className="flex flex-1 gap-1.5">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === idx ? "step" : undefined}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= idx ? "bg-primary" : "bg-white/15")}
              >
                <span className="sr-only">
                  Step {i + 1} of {STEPS.length}
                  {i === idx ? " (current)" : ""}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          aria-labelledby="step-heading"
        >
          {step === "intro" && (
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <Badge variant="secondary">Google DevFest Toronto 2026</Badge>
                <h1 id="step-heading" className="font-display text-4xl leading-[1.05] font-bold sm:text-5xl">
                  Light up the skyline with{" "}
                  <span className="bg-gradient-to-r from-[#FFC93C] via-[#FF8A3D] to-[#E8384F] bg-clip-text text-transparent">
                    your tile
                  </span>
                  .
                </h1>
                <p className="text-lg text-muted-foreground">
                  300 attendees. One collaborative artwork of Toronto. Pick a colour and a symbol, share your hope for the
                  future — and watch it join the city.
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                <MosaicSvg tiles={tileMap} mode="art" fresh={fresh} className="block h-auto w-full" />
              </div>
              <p className="text-center text-sm text-muted-foreground" aria-live="polite">
                <LiveCounter value={state.aggregates.totalContributions} className="font-semibold text-foreground" /> of{" "}
                {TOTAL_TILES} tiles lit
              </p>
              {closed || full ? (
                <div role="status" className="rounded-2xl bg-white/5 p-4 text-center">
                  {full ? "The skyline is complete — all 300 tiles are lit! 🎉" : "Submissions are paused right now. Check back soon!"}
                </div>
              ) : (
                <Button size="lg" className="w-full" onClick={() => setStep("color")} disabled={!ready && !own}>
                  {!ready ? <Loader2 className="animate-spin" /> : <Sparkles />} Create my tile
                </Button>
              )}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>No sign-up · about 30 seconds</span>
                <Link href="/mosaic" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Explore the mosaic →
                </Link>
              </div>
              {sessionError && (
                <p role="alert" className="text-sm text-rose-200">
                  {sessionError}
                </p>
              )}
            </div>
          )}

          {step === "color" && (
            <StepShell title="Choose your colour" subtitle="Each colour re-inks a piece of the skyline." headingRef={headingRef}>
              <RadioGrid
                label="Colour"
                cols="grid-cols-2 sm:grid-cols-3"
                value={draft.color}
                onChange={(color) => setDraft((d) => ({ ...d, color: color as ColorId }))}
                options={COLORS.map((c) => ({
                  value: c.id,
                  label: c.name,
                  render: (checked) => (
                    <span className="flex w-full items-center gap-3">
                      <span
                        className={cn("size-10 shrink-0 rounded-xl ring-2 transition", checked ? "ring-white" : "ring-transparent")}
                        style={{ background: c.hex }}
                        aria-hidden="true"
                      />
                      <span className="text-left text-sm font-semibold">{c.name}</span>
                    </span>
                  ),
                }))}
              />
              <NextButton disabled={!draft.color} onClick={() => setStep("symbol")} />
            </StepShell>
          )}

          {step === "symbol" && (
            <StepShell title="Pick a symbol" subtitle="Something that says “you” or the future you imagine." headingRef={headingRef}>
              {draft.color && draft.symbol && <TilePreview color={draft.color} symbol={draft.symbol} motif={motif} />}
              <RadioGrid
                label="Symbol"
                cols="grid-cols-4 sm:grid-cols-6"
                value={draft.symbol}
                onChange={(symbol) => setDraft((d) => ({ ...d, symbol }))}
                options={SYMBOLS.map((s) => ({
                  value: s.char,
                  label: s.label,
                  render: () => (
                    <span className="text-3xl" aria-hidden="true">
                      {s.char}
                    </span>
                  ),
                }))}
                compact
              />
              <NextButton disabled={!draft.symbol} onClick={() => setStep("message")} />
            </StepShell>
          )}

          {step === "message" && (
            <MessageStep
              value={draft.message}
              onChange={(message) => setDraft((d) => ({ ...d, message }))}
              onNext={() => setStep("preview")}
              headingRef={headingRef}
            />
          )}

          {step === "preview" && draft.color && draft.symbol && (
            <StepShell title="Preview your tile" subtitle="Your exact spot in the skyline is assigned when you submit." headingRef={headingRef}>
              <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                <TileCardSvg color={draft.color} symbol={draft.symbol} message={draft.message} motif={motif} className="block h-auto w-full" />
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Button variant="outline" size="sm" onClick={() => setStep("color")}>
                  Change colour
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStep("symbol")}>
                  Change symbol
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStep("message")}>
                  Edit message
                </Button>
              </div>
              {error && (
                <div role="alert" className="space-y-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4">
                  <p>{error.message}</p>
                  {error.retry && (
                    <Button variant="outline" size="sm" onClick={submit} disabled={submitting}>
                      <RotateCcw /> Try again
                    </Button>
                  )}
                </div>
              )}
              <Button size="lg" className="w-full" onClick={submit} disabled={submitting || closed || full} data-testid="submit-tile">
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Placing your tile…
                  </>
                ) : (
                  <>Add my tile to the skyline</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                One tile per person. Messages are reviewed before they appear on the big screen.
              </p>
            </StepShell>
          )}

          {step === "done" && own && <Success own={own} tileMap={tileMap} fresh={fresh} headingRef={headingRef} />}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
  headingRef,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 id="step-heading" ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold outline-none">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function NextButton({ disabled, onClick, label = "Next" }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button size="lg" className="w-full" disabled={disabled} onClick={onClick}>
      {label} <ArrowRight />
    </Button>
  );
}

/** Accessible radio group rendered as large touch targets (arrow keys supported). */
function RadioGrid({
  label,
  options,
  value,
  onChange,
  cols,
  compact,
}: {
  label: string;
  options: { value: string; label: string; render: (checked: boolean) => React.ReactNode }[];
  value: string | null;
  onChange: (v: string) => void;
  cols: string;
  compact?: boolean;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className={cn("grid gap-2.5", cols)}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-2xl border bg-white/5 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring",
                compact ? "aspect-square p-1" : "min-h-16 p-3",
                checked ? "border-white bg-white/15 shadow-lg" : "border-white/10 hover:bg-white/10",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
                aria-label={o.label}
              />
              {o.render(checked)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function MessageStep({
  value,
  onChange,
  onNext,
  headingRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const len = graphemeLength(value);
  const over = len > MESSAGE_MAX;
  return (
    <StepShell title={PROMPT} subtitle="Optional — a few words is perfect." headingRef={headingRef}>
      <div className="space-y-2">
        <label htmlFor="message" className="sr-only">
          {PROMPT} (optional, up to {MESSAGE_MAX} characters)
        </label>
        <Textarea
          id="message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. A city where every neighbourhood is connected by green transit"
          maxLength={MESSAGE_MAX * 2}
          aria-describedby="message-help message-count"
          aria-invalid={over}
          rows={4}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span id="message-help">Please don&apos;t include names, emails or links.</span>
          <span id="message-count" className={cn(over && "font-semibold text-rose-300")} aria-live="polite">
            {len}/{MESSAGE_MAX}
          </span>
        </div>
      </div>
      <NextButton disabled={over} onClick={onNext} label={value.trim() ? "Preview my tile" : "Skip & preview"} />
    </StepShell>
  );
}

function Success({
  own,
  tileMap,
  fresh,
  headingRef,
}: {
  own: OwnContribution;
  tileMap: ReadonlyMap<string, import("@/lib/types").PublicTile>;
  fresh: ReadonlySet<string>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const c = getColor(own.color);
  // Make sure the attendee's tile shows immediately even before the feed catches up.
  const tiles = new Map(tileMap);
  if (!tiles.has(own.tileId)) {
    tiles.set(own.tileId, {
      tileId: own.tileId,
      contributionId: own.id,
      color: own.color,
      symbol: own.symbol,
      message: null,
      caption: null,
      motif: own.motif,
      seq: Number.MAX_SAFE_INTEGER,
    });
  }
  return (
    <div className="space-y-5" data-testid="success">
      <div className="space-y-1">
        <Badge variant="success">Tile placed ✓</Badge>
        <h1 id="step-heading" ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold outline-none">
          You&apos;re part of the skyline!
        </h1>
        <p className="text-muted-foreground" data-testid="tile-label">
          Your {c.name.toLowerCase()} {own.symbol} tile lives at <strong className="text-foreground">{tileLabel(own.tileId)}</strong>.
        </p>
      </div>
      <motion.div
        initial={{ scale: 2.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
        style={{ transformOrigin: originFor(own.tileId) }}
      >
        <MosaicSvg tiles={tiles} mode="art" highlight={own.tileId} fresh={fresh} className="block h-auto w-full" />
      </motion.div>
      {own.message && own.moderationStatus === "pending" && (
        <p className="rounded-2xl bg-white/5 p-3 text-sm text-muted-foreground" role="status">
          Your message is being reviewed and will appear on the big screen once approved.
        </p>
      )}
      {own.moderationStatus === "hidden" && (
        <p className="rounded-2xl bg-white/5 p-3 text-sm text-muted-foreground" role="status">
          Your tile is in the artwork. Your message won&apos;t be shown publicly.
        </p>
      )}
      <ShareActions contribution={own} />
      <Button asChild size="lg" variant="outline" className="w-full">
        <Link href={`/mosaic?tile=${own.tileId}`}>Explore everyone&apos;s tiles</Link>
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Watch the full skyline revealed at the closing ceremony. 🎆
      </p>
    </div>
  );
}

function originFor(id: string) {
  const m = /^r(\d{2})c(\d{2})$/.exec(id);
  if (!m) return "50% 50%";
  return `${((Number(m[2]) + 0.5) / 20) * 100}% ${((Number(m[1]) + 0.5) / 15) * 100}%`;
}
