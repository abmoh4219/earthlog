"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { usePlayer } from "@/player/store";

/** Copy a link that opens this film at this moment and plays (?t=…&play). */
export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const t = new Date(usePlayer.getState().clock.t).toISOString().replace(/\.\d{3}Z$/, "Z");
    const url = `${window.location.origin}${window.location.pathname}?t=${t}&play`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      title={copied ? "Link copied" : "Copy a link to this moment"}
      className="grid size-9 place-items-center rounded-lg border border-transparent text-dust/45 transition hover:text-dust/80"
    >
      {copied ? <Check size={16} className="text-dust" /> : <Link2 size={16} />}
    </button>
  );
}
