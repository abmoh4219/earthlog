import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { Yours } from "@/components/Yours";

export const metadata: Metadata = {
  title: "Yours",
  description: "The stories you follow, your game and the films you watched, kept in your browser.",
};

export default function YoursPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-void">
      <SiteNav />
      <Yours />
    </div>
  );
}
