"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { ApiError, api } from "@/lib/client/api";
import { getClientAuth } from "@/lib/client/firebase";
import { isFirebaseMode } from "@/lib/env";
import { Dashboard } from "./Dashboard";

type Session = { mode: "firebase" | "local"; organizer: { id: string; email: string | null } | null };

export function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passcode, setPasscode] = useState("");

  const check = useCallback(async () => {
    try {
      setSession(await api<Session>("/api/admin/session", { auth: "organizer" }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (isFirebaseMode()) {
        const auth = await getClientAuth();
        await auth?.authStateReady();
      }
      await check();
    })();
  }, [check]);

  const googleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const auth = await getClientAuth();
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth!, new GoogleAuthProvider());
      await check();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const passcodeSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/session", { method: "POST", auth: "none", body: JSON.stringify({ passcode }) });
      await check();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (isFirebaseMode()) {
      const auth = await getClientAuth();
      await auth?.signOut();
    } else {
      await api("/api/admin/session", { method: "DELETE", auth: "none" });
    }
    await check();
  };

  if (!session) {
    return (
      <div className="grid h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!session.organizer) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-md px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Organizer sign-in</CardTitle>
              <CardDescription>
                {session.mode === "firebase"
                  ? "Sign in with an authorized Google account."
                  : "Local prototype mode — enter the organizer passcode (LOCAL_ADMIN_PASSCODE)."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {session.mode === "firebase" ? (
                <Button className="w-full" onClick={googleSignIn} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Sign in with Google
                </Button>
              ) : (
                <form onSubmit={passcodeSignIn} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="passcode">Passcode</Label>
                    <Input id="passcode" type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy || !passcode}>
                    Sign in
                  </Button>
                </form>
              )}
              {error && (
                <p role="alert" className="text-sm text-rose-200">
                  {error}
                </p>
              )}
              {session.mode === "firebase" && (
                <p className="text-xs text-muted-foreground">
                  Signed in but still seeing this? Your account isn&apos;t on the organizer list (ORGANIZER_EMAILS).
                </p>
              )}
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        right={
          <>
            <span className="hidden text-muted-foreground sm:inline">{session.organizer.email ?? "Organizer"}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </>
        }
      />
      <main id="main">
        <Dashboard />
      </main>
    </>
  );
}
