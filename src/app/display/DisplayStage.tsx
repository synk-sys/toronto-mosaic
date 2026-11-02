"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import { Maximize, Minimize } from "lucide-react";
import { LiveCounter } from "@/components/LiveCounter";
import { MosaicSvg, type MosaicMode } from "@/components/mosaic/MosaicSvg";
import { Logo } from "@/components/SiteHeader";
import { useMosaicFeed, useTileIndex } from "@/hooks/useMosaicFeed";
import { syntheticState } from "@/lib/demo";
import { tileLabel, TOTAL_TILES } from "@/lib/grid";
import { EVENT_NAME, FINAL_MESSAGE, getColor } from "@/lib/palette";
import type { PublicMosaicState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "collecting" | "blackout" | "tiles" | "merge" | "final";

/** Synthetic feed for rehearsals: tiles arrive one by one; never touches real data. */
function useDemoFeed(target: number, enabled: boolean) {
  const [count, setCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!enabled || count >= target) return;
    const t = setTimeout(() => setCount((c) => c + 1), count < 20 ? 500 : 180);
    return () => clearTimeout(t);
  }, [enabled, count, target]);
  const state = useMemo<PublicMosaicState>(() => syntheticState(count, revealed), [count, revealed]);
  return { state, setRevealed, revealed, fillAll: () => setCount(target) };
}

export function DisplayStage() {
  const params = useSearchParams();
  const demoParam = params.get("demo");
  const demo = demoParam !== null;
  const demoTarget = Math.min(TOTAL_TILES, Math.max(1, Number(demoParam) || 180));
  const reduce = useReducedMotion();

  const live = useMosaicFeed({ disabled: demo, pollMs: 2000 });
  const demoFeed = useDemoFeed(demoTarget, demo);
  const state = demo ? demoFeed.state : live.state;
  const demoIndex = useTileIndex(demoFeed.state.tiles);
  const { tileMap, fresh } = demo ? demoIndex : live;

  const revealMode = state.config.revealMode;
  const [phase, setPhase] = useState<Phase>("collecting");
  const prevMode = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runReveal = useCallback(() => {
    timers.current.forEach(clearTimeout);
    const steps: [Phase, number][] = reduce
      ? [["final", 0]]
      : [["blackout", 0], ["tiles", 1600], ["merge", 5200], ["final", 11000]];
    timers.current = steps.map(([p, at]) => setTimeout(() => setPhase(p), at));
  }, [reduce]);

  // Organizer-controlled trigger: react to revealMode changes from the database.
  useEffect(() => {
    if (prevMode.current === null) {
      prevMode.current = revealMode;
      // Loaded after the reveal already happened → show the finished artwork.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (revealMode === "revealed") setPhase("final");
      return;
    }
    if (revealMode !== prevMode.current) {
      prevMode.current = revealMode;
      if (revealMode === "revealed") runReveal();
      else {
        timers.current.forEach(clearTimeout);
        setPhase("collecting");
      }
    }
  }, [revealMode, runReveal]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Fullscreen + keyboard shortcuts + idle cursor.
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const [idle, setIdle] = useState(false);
  const toggleFs = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {}
  }, []);
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 3000);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFs();
      if (demo && (e.key === "r" || e.key === "R")) demoFeed.setRevealed(!demoFeed.revealed);
      if (demo && (e.key === "a" || e.key === "A")) demoFeed.fillAll();
      if (e.key === "p" || e.key === "P") revealMode === "revealed" && runReveal();
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", onKey);
    wake();
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [toggleFs, demo, demoFeed, revealMode, runReveal]);

  // Join QR code.
  const [qr, setQr] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;
    // window.location is browser-only; set after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#0b0d2e", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, []);

  // Latest arrival callout.
  const latest = useMemo(() => {
    const id = [...fresh].at(-1);
    return id ? tileMap.get(id) : undefined;
  }, [fresh, tileMap]);

  const messages = state.config.publicMessagesEnabled ? state.tiles.filter((t) => t.message).slice(-12).reverse() : [];
  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setTicker((i) => i + 1), 6000);
    return () => clearInterval(t);
  }, [messages.length]);
  const currentMsg = messages.length ? messages[ticker % messages.length] : null;

  const count = state.aggregates.totalContributions;
  const mode: MosaicMode = phase === "tiles" || phase === "blackout" ? "tiles" : phase === "collecting" ? "art" : "art";
  const revealedArt = phase === "merge" || phase === "final";
  const showSidebar = phase === "collecting";

  return (
    <div
      ref={rootRef}
      data-testid="display-root"
      data-phase={phase}
      className={cn("relative flex h-dvh w-full overflow-hidden bg-[#04051a] text-white", idle && "cursor-none")}
    >
      {demo && (
        <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-1 text-sm font-bold text-black" role="status">
          DEMO MODE — synthetic data · R reveal · A fill
        </div>
      )}

      <div className={cn("flex min-w-0 flex-1 items-center justify-center p-[2vmin] transition-all duration-1000", !showSidebar && "p-0")}>
        <motion.div
          className="relative aspect-[4/3] max-h-full w-full max-w-full"
          style={{ maxWidth: "calc((100dvh - 4vmin) * 4 / 3)" }}
          animate={{ opacity: phase === "blackout" ? 0.08 : 1, scale: phase === "final" ? 1.02 : 1 }}
          transition={{ duration: phase === "blackout" ? 1.2 : 2 }}
        >
          <MosaicSvg
            tiles={tileMap}
            mode={mode}
            revealed={revealedArt}
            fresh={phase === "collecting" ? fresh : undefined}
            waveMs={phase === "collecting" ? 0 : 110}
            className="size-full overflow-hidden rounded-[1.5vmin] shadow-[0_0_120px_-20px_rgba(255,180,120,0.45)]"
          />
          {(phase === "merge" || phase === "final") && !reduce && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5vmin]" aria-hidden="true">
              <div
                className="beam absolute top-[6%] left-[31%] h-[160%] w-[18%] -translate-x-1/2"
                style={{ background: "linear-gradient(to bottom, rgba(255,240,200,0.55), rgba(255,240,200,0) 70%)", clipPath: "polygon(48% 0, 52% 0, 100% 100%, 0 100%)" }}
              />
            </div>
          )}
          <AnimatePresence>
            {latest && phase === "collecting" && (
              <motion.div
                key={latest.tileId}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute bottom-[4%] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 py-2 pr-6 pl-2 backdrop-blur"
                role="status"
              >
                <span className="grid size-12 place-items-center rounded-full text-3xl" style={{ background: getColor(latest.color).hex }}>
                  {latest.symbol}
                </span>
                <span className="text-xl font-semibold">New tile · {tileLabel(latest.tileId)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.8 }}
            className="flex w-[clamp(240px,24vw,440px)] shrink-0 flex-col justify-between gap-[2vh] py-[4vh] pr-[3vmin]"
          >
            <div className="space-y-2">
              <Logo className="text-[2.2vmin]" />
              <p className="text-[1.6vmin] text-white/70">{EVENT_NAME}</p>
            </div>
            <div>
              <p className="font-display text-[11vmin] leading-none font-bold tabular-nums" data-testid="display-count">
                <LiveCounter value={count} />
              </p>
              <p className="text-[2.2vmin] text-white/80">
                {count === 1 ? "tile" : "tiles"} lit of {TOTAL_TILES}
              </p>
              <div className="mt-[1.5vh] h-[1vh] overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#FFC93C] via-[#FF8A3D] to-[#E8384F]"
                  animate={{ width: `${(count / TOTAL_TILES) * 100}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
            <div className="min-h-[14vh]">
              <AnimatePresence mode="wait">
                {currentMsg && (
                  <motion.blockquote
                    key={currentMsg.tileId + ticker}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-[2.3vmin] leading-snug"
                  >
                    <span className="mr-2">{currentMsg.symbol}</span>“{currentMsg.message}”
                  </motion.blockquote>
                )}
              </AnimatePresence>
            </div>
            {state.config.submissionsEnabled && (
              <div className="flex items-center gap-[1.5vmin] rounded-[1.5vmin] bg-white p-[1.2vmin] text-[#0b0d2e]">
                {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL */}
                {qr && <img src={qr} alt={`QR code to join at ${joinUrl}`} className="size-[14vmin] shrink-0" />}
                <div>
                  <p className="text-[2.2vmin] font-bold leading-tight">Add your tile</p>
                  <p className="text-[1.5vmin] break-all opacity-70">{joinUrl.replace(/^https?:\/\//, "")}</p>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "final" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, delay: reduce ? 0 : 0.5 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-[4vmin] pt-[14vh] pb-[6vh] text-center"
            data-testid="final-message"
          >
            <p className="font-display text-[6.5vmin] leading-tight font-bold">{FINAL_MESSAGE}</p>
            <p className="mt-[1.5vh] text-[2.6vmin] text-white/85">
              Created together by <strong className="text-white">{count.toLocaleString()}</strong> {count === 1 ? "person" : "people"} at{" "}
              {EVENT_NAME}
              {demo && " (demo data)"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggleFs}
        className={cn(
          "absolute top-3 right-3 z-30 rounded-full bg-white/10 p-3 transition-opacity hover:bg-white/20",
          idle ? "opacity-0" : "opacity-100",
        )}
        aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
        data-testid="fullscreen-toggle"
      >
        {isFs ? <Minimize /> : <Maximize />}
      </button>
      {!demo && live.status === "reconnecting" && (
        <div className="absolute bottom-3 left-3 rounded-full bg-amber-500/80 px-3 py-1 text-xs font-semibold text-black">Reconnecting…</div>
      )}
    </div>
  );
}
