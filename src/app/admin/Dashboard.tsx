"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Download, EyeOff, ExternalLink, Flag, Loader2, Monitor, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MosaicSvg, type MosaicMode } from "@/components/mosaic/MosaicSvg";
import { useMosaicFeed } from "@/hooks/useMosaicFeed";
import { api } from "@/lib/client/api";
import { downloadBlob, renderSvgMarkup, svgBlob, svgToPng } from "@/lib/art/export";
import { ART_H, ART_W, tileLabel } from "@/lib/grid";
import { getColor } from "@/lib/palette";
import type { AdminContribution, Aggregates, EventConfig, ModerationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { id: ModerationStatus | "all"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "hidden", label: "Hidden" },
  { id: "removed", label: "Removed" },
  { id: "all", label: "All" },
];

const org = { auth: "organizer" as const };

export function Dashboard() {
  const { state, tileMap } = useMosaicFeed({ pollMs: 3000 });
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [tab, setTab] = useState<ModerationStatus | "all">("pending");
  const [rows, setRows] = useState<AdminContribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<MosaicMode>("art");
  const [maint, setMaint] = useState<{ demoSeedAllowed: boolean; resetAllowed: boolean } | null>(null);

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = tab === "all" ? "" : `?status=${tab}`;
      const [list, cfg] = await Promise.all([
        api<{ contributions: AdminContribution[]; aggregates: Aggregates }>(`/api/admin/contributions${q}`, org),
        api<{ config: EventConfig }>("/api/admin/config", org),
      ]);
      setRows(list.contributions);
      setAggregates(list.aggregates);
      setConfig(cfg.config);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    // Data fetching: initial load + polling.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    api<{ demoSeedAllowed: boolean; resetAllowed: boolean }>("/api/admin/maintenance", org).then(setMaint).catch(() => {});
  }, []);

  const patchConfig = async (patch: Partial<EventConfig>) => {
    try {
      const { config } = await api<{ config: EventConfig }>("/api/admin/config", { ...org, method: "PATCH", body: JSON.stringify(patch) });
      setConfig(config);
      flash("Settings saved");
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const moderate = async (id: string, action: "approve" | "hide" | "remove") => {
    if (action === "remove" && !confirm("Remove this contribution? Its tile will be freed. This cannot be undone.")) return;
    try {
      await api(`/api/admin/contributions/${id}`, { ...org, method: "PATCH", body: JSON.stringify({ action }) });
      setRows((r) => (tab === "all" ? r : r.filter((x) => x.id !== id)));
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const maintenance = async (body: Record<string, unknown>, ok: string) => {
    try {
      await api("/api/admin/maintenance", { ...org, method: "POST", body: JSON.stringify(body) });
      flash(ok);
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const exportData = async (format: "csv" | "json") => {
    const headers: Record<string, string> = {};
    // Reuse the API client's auth header logic by fetching through it for JSON;
    // for CSV we need the raw body, so fetch with the same credentials.
    const { getClientAuth } = await import("@/lib/client/firebase");
    const auth = await getClientAuth();
    if (auth?.currentUser) headers.authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    const res = await fetch(`/api/admin/export?format=${format}`, { headers, credentials: "same-origin" });
    if (!res.ok) return flash("Export failed");
    const blob = await res.blob();
    downloadBlob(blob, `toronto-mosaic-approved.${format}`);
  };

  const [artBusy, setArtBusy] = useState(false);
  const downloadArtwork = async (kind: "png" | "svg", revealed: boolean) => {
    setArtBusy(true);
    try {
      const markup = renderSvgMarkup(
        <MosaicSvg standalone tiles={tileMap} mode="art" revealed={revealed} width={ART_W} height={ART_H} />,
      );
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      if (kind === "svg") downloadBlob(svgBlob(markup), `toronto-mosaic-${stamp}.svg`);
      else downloadBlob(await svgToPng(markup, ART_W * 3, ART_H * 3), `toronto-mosaic-${stamp}-6000x4500.png`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setArtBusy(false);
    }
  };

  const agg = aggregates ?? state.aggregates;
  const stats = [
    { label: "Total contributions", value: agg.totalContributions },
    { label: "Approved", value: agg.approvedContributions },
    { label: "Pending review", value: agg.pendingContributions, warn: agg.pendingContributions > 0 },
    { label: "Tiles remaining", value: agg.remainingTiles },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Organizer dashboard</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/display" target="_blank" rel="noopener">
              <Monitor /> Projector
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/display?demo=220" target="_blank" rel="noopener">
              Rehearsal demo <ExternalLink />
            </a>
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6 text-sm text-emerald-200">
        {notice}
      </div>

      <section aria-label="Statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={cn(s.warn && "border-amber-300/50")}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display text-3xl font-bold tabular-nums" data-testid={`stat-${s.label}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Live mosaic</CardTitle>
            <div className="flex gap-1">
              {(["art", "tiles"] as const).map((m) => (
                <Button key={m} size="sm" variant={previewMode === m ? "default" : "ghost"} onClick={() => setPreviewMode(m)} aria-pressed={previewMode === m}>
                  {m === "art" ? "Skyline" : "Tiles"}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <MosaicSvg tiles={tileMap} mode={previewMode} revealed={config?.revealMode === "revealed"} className="block h-auto w-full rounded-xl" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => downloadArtwork("png", true)} disabled={artBusy} data-testid="download-artwork">
                {artBusy ? <Loader2 className="animate-spin" /> : <Download />} High-res PNG (6000×4500)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => downloadArtwork("svg", true)} disabled={artBusy}>
                <Download /> Vector SVG
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Event controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {config && (
                <>
                  <ToggleRow
                    label="Submissions open"
                    description="Pause to stop new tiles (e.g. before the reveal)."
                    checked={config.submissionsEnabled}
                    onChange={(v) => patchConfig({ submissionsEnabled: v })}
                  />
                  <ToggleRow
                    label="Message moderation"
                    description="New messages wait for approval. Flagged messages always wait."
                    checked={config.moderationEnabled}
                    onChange={(v) => patchConfig({ moderationEnabled: v })}
                  />
                  <ToggleRow
                    label="Show messages publicly"
                    description="Approved messages on the projector and explorer."
                    checked={config.publicMessagesEnabled}
                    onChange={(v) => patchConfig({ publicMessagesEnabled: v })}
                  />
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="font-semibold">Closing ceremony</p>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Status: <strong>{config.revealMode === "revealed" ? "Revealed" : "Collecting"}</strong>. Open the projector first, then trigger.
                    </p>
                    {config.revealMode === "revealed" ? (
                      <Button variant="outline" onClick={() => patchConfig({ revealMode: "collecting" })}>
                        Return to collecting
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        data-testid="trigger-reveal"
                        onClick={() => confirm("Trigger the skyline reveal on every projector now?") && patchConfig({ revealMode: "revealed" })}
                      >
                        🎆 Trigger the reveal
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <QrCard />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moderation</CardTitle>
          <CardDescription>
            Approve shows a message publicly. Hide keeps the tile but hides the message. Remove deletes the tile from the artwork.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div role="tablist" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? "default" : "ghost"} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === "pending" && agg.pendingContributions > 0 && <Badge variant="warning">{agg.pendingContributions}</Badge>}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={load} aria-label="Refresh">
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Nothing here right now.</p>
          ) : (
            <ul className="divide-y divide-white/10" data-testid="moderation-list">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: getColor(r.color).hex }} aria-hidden="true">
                    {r.symbol}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("break-words", !r.message && "text-muted-foreground italic")}>{r.message || "No message"}</p>
                    {r.aiCaption && <p className="text-sm text-muted-foreground italic">AI caption: {r.aiCaption}</p>}
                    <p className="text-xs text-muted-foreground">
                      {tileLabel(r.tileId)} · {new Date(r.createdAt).toLocaleTimeString()} · <StatusBadge status={r.moderationStatus} />
                      {r.flagged && (
                        <Badge variant="danger" className="ml-1">
                          <Flag className="size-3" /> auto-flagged
                        </Badge>
                      )}
                    </p>
                  </div>
                  {r.moderationStatus !== "removed" && (
                    <div className="flex gap-1">
                      {r.moderationStatus !== "approved" && (
                        <Button size="sm" variant="secondary" onClick={() => moderate(r.id, "approve")} aria-label={`Approve ${r.message || "contribution"}`}>
                          <Check /> Approve
                        </Button>
                      )}
                      {r.moderationStatus !== "hidden" && r.message && (
                        <Button size="sm" variant="ghost" onClick={() => moderate(r.id, "hide")}>
                          <EyeOff /> Hide
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-rose-200" onClick={() => moderate(r.id, "remove")}>
                        <Trash2 /> Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Approved contributions only. No participant identifiers.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="secondary" onClick={() => exportData("csv")}>
              <Download /> CSV
            </Button>
            <Button variant="secondary" onClick={() => exportData("json")}>
              <Download /> JSON
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
            <CardDescription>Reconcile counters or prepare rehearsals.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => maintenance({ action: "recount" }, "Aggregates recounted")}>
              Recount totals
            </Button>
            <Button variant="outline" size="sm" onClick={() => maintenance({ action: "seed-tiles" }, "Tile documents initialised")}>
              Initialise tiles
            </Button>
            {maint?.demoSeedAllowed && (
              <Button variant="outline" size="sm" onClick={() => maintenance({ action: "seed-demo", count: 60 }, "Added 60 synthetic tiles")}>
                Seed 60 synthetic tiles
              </Button>
            )}
            {maint?.resetAllowed && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => prompt("Type RESET to delete ALL contributions") === "RESET" && maintenance({ action: "reset", confirm: "RESET" }, "All data reset")}
              >
                Reset all data
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ModerationStatus }) {
  const v = { pending: "warning", approved: "success", hidden: "secondary", removed: "danger" } as const;
  return <Badge variant={v[status]}>{status}</Badge>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = label.replace(/\s/g, "-").toLowerCase();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function QrCard() {
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only origin
    setUrl(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin);
  }, []);
  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0b0d2e", light: "#ffffff" } }).then(setSvg).catch(() => setSvg(""));
  }, [url]);
  const downloadPng = async () => {
    const data = await QRCode.toDataURL(url, { margin: 2, width: 2048 });
    const blob = await (await fetch(data)).blob();
    downloadBlob(blob, "toronto-mosaic-qr.png");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event QR code</CardTitle>
        <CardDescription>Print for tables, badges and signage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor="qr-url" className="sr-only">
          QR code URL
        </label>
        <Input id="qr-url" value={url} onChange={(e) => setUrl(e.target.value)} />
        {svg && <div className="mx-auto w-40 overflow-hidden rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`QR code for ${url}`} />}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={downloadPng}>
            <Download /> PNG (2048px)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "toronto-mosaic-qr.svg")}>
            <Download /> SVG
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
