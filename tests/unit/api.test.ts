import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { setServiceForTests } from "@/lib/server/context";
import { MemoryDb } from "@/lib/server/db";
import { MosaicService } from "@/lib/server/mosaic-service";
import { POST as createSession } from "@/app/api/session/route";
import { POST as submit } from "@/app/api/contributions/route";
import { GET as me } from "@/app/api/contributions/me/route";
import { GET as publicContribution } from "@/app/api/contributions/[id]/route";
import { GET as mosaic } from "@/app/api/mosaic/route";
import { GET as adminList } from "@/app/api/admin/contributions/route";
import { PATCH as adminConfig } from "@/app/api/admin/config/route";
import { POST as adminLogin } from "@/app/api/admin/session/route";

const BASE = "http://localhost:3000";

async function session(): Promise<string> {
  const res = await createSession(new NextRequest(`${BASE}/api/session`, { method: "POST" }));
  const cookie = res.headers.get("set-cookie")!;
  return cookie.split(";")[0];
}

function req(path: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? "GET",
    body: init.body ? JSON.stringify(init.body) : undefined,
    headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  setServiceForTests(new MosaicService(new MemoryDb(), { publicCacheMs: 0, occupiedCacheMs: 0 }));
});

describe("participant API", () => {
  it("requires a session and ignores client-supplied identifiers", async () => {
    const noSession = await submit(req("/api/contributions", { method: "POST", body: { color: "lake", symbol: "🍁" } }));
    expect(noSession.status).toBe(401);

    const cookie = await session();
    const sneaky = await submit(
      req("/api/contributions", { method: "POST", cookie, body: { color: "lake", symbol: "🍁", tileId: "r00c00", participantUid: "x" } }),
    );
    expect(sneaky.status).toBe(400); // strict schema rejects extra fields

    const ok = await submit(req("/api/contributions", { method: "POST", cookie, body: { color: "lake", symbol: "🍁", message: "Hi" } }));
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.contribution.tileId).toMatch(/^r\d{2}c\d{2}$/);
    expect(JSON.stringify(body)).not.toContain("participantUid");

    const dup = await submit(req("/api/contributions", { method: "POST", cookie, body: { color: "maple", symbol: "🚀" } }));
    expect(dup.status).toBe(200);
    expect((await dup.json()).contribution.id).toBe(body.contribution.id);

    const mine = await (await me(req("/api/contributions/me", { cookie }))).json();
    expect(mine.contribution.id).toBe(body.contribution.id);
  });

  it("rejects forged session cookies", async () => {
    const res = await submit(
      req("/api/contributions", { method: "POST", cookie: "mosaic_pid=p_forged.bad-signature", body: { color: "lake", symbol: "🍁" } }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unknown symbols, colours and over-long messages", async () => {
    const cookie = await session();
    for (const body of [
      { color: "pink", symbol: "🍁" },
      { color: "lake", symbol: "💩" },
      { color: "lake", symbol: "🍁", message: "x".repeat(121) },
    ]) {
      expect((await submit(req("/api/contributions", { method: "POST", cookie, body }))).status).toBe(400);
    }
  });

  it("blocks cross-site submissions", async () => {
    const cookie = await session();
    const res = await submit(
      req("/api/contributions", { method: "POST", cookie, body: { color: "lake", symbol: "🍁" }, headers: { origin: "https://evil.example", host: "localhost:3000" } }),
    );
    expect(res.status).toBe(403);
  });

  it("rate-limits a participant hammering the submit endpoint", async () => {
    const cookie = await session();
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      statuses.push((await submit(req("/api/contributions", { method: "POST", cookie, body: { color: "lake", symbol: "🍁" } }))).status);
    }
    expect(statuses).toContain(429);
  });

  it("public endpoints expose no participant identifiers or pending messages", async () => {
    const cookie = await session();
    const created = await (await submit(req("/api/contributions", { method: "POST", cookie, body: { color: "gold", symbol: "⭐", message: "pending text" } }))).json();
    const state = await (await mosaic(req("/api/mosaic"))).json();
    expect(JSON.stringify(state)).not.toMatch(/participantUid|p_[a-f0-9]{32}|pending text/);
    const stranger = await publicContribution(req(`/api/contributions/${created.contribution.id}`), {
      params: Promise.resolve({ id: created.contribution.id }),
    });
    expect((await stranger.json()).contribution.message).toBeNull();
  });
});

describe("organizer API", () => {
  it("rejects unauthenticated and wrong-passcode access", async () => {
    expect((await adminList(req("/api/admin/contributions"), undefined)).status).toBe(401);
    expect((await adminConfig(req("/api/admin/config", { method: "PATCH", body: { revealMode: "revealed" } }), undefined)).status).toBe(401);
    const bad = await adminLogin(req("/api/admin/session", { method: "POST", body: { passcode: "nope" } }));
    expect(bad.status).toBe(401);
  });

  it("allows a signed-in organizer to trigger the reveal", async () => {
    const login = await adminLogin(req("/api/admin/session", { method: "POST", body: { passcode: "devfest" } }));
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const res = await adminConfig(req("/api/admin/config", { method: "PATCH", cookie, body: { revealMode: "revealed" } }), undefined);
    expect(res.status).toBe(200);
    const state = await (await mosaic(req("/api/mosaic"))).json();
    expect(state.config.revealMode).toBe("revealed");
  });

  it("a participant cookie does not grant organizer access", async () => {
    const cookie = await session();
    expect((await adminList(req("/api/admin/contributions", { cookie }), undefined)).status).toBe(401);
  });
});
