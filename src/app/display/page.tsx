import type { Metadata } from "next";
import { Suspense } from "react";
import { DisplayStage } from "./DisplayStage";

export const metadata: Metadata = { title: "Projector", robots: { index: false } };

export default function DisplayPage() {
  return (
    <Suspense>
      <DisplayStage />
    </Suspense>
  );
}
