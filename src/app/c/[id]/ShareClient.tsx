"use client";

import { useEffect, useState } from "react";
import { ShareActions } from "@/components/create/ShareActions";
import { TileCardSvg } from "@/components/mosaic/TileCardSvg";
import { api } from "@/lib/client/api";
import type { PublicContribution } from "@/lib/types";

/** Re-fetches with the viewer's credentials so owners also see their own pending message. */
export function ShareClient({ id, initial, children }: { id: string; initial: PublicContribution; children: React.ReactNode }) {
  const [c, setC] = useState(initial);
  const [personal, setPersonal] = useState(false);
  useEffect(() => {
    api<{ contribution: PublicContribution }>(`/api/contributions/${id}`)
      .then(({ contribution }) => {
        if (contribution.message !== initial.message) {
          setC(contribution);
          setPersonal(true);
        }
      })
      .catch(() => {});
  }, [id, initial.message]);
  return (
    <div className="space-y-4">
      {personal ? (
        <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
          <TileCardSvg {...c} className="block h-auto w-full" />
        </div>
      ) : (
        children
      )}
      <ShareActions contribution={c} />
    </div>
  );
}
