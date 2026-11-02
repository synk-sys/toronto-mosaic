import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CreateFlow } from "@/components/create/CreateFlow";

export default function Home() {
  return (
    <>
      <SiteHeader
        right={
          <Link href="/mosaic" className="rounded-full px-3 py-2 hover:bg-white/10">
            Explore
          </Link>
        }
      />
      <main id="main" className="pt-2">
        <CreateFlow />
      </main>
    </>
  );
}
