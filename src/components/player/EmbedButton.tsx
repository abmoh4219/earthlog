"use client";

// Copy the code that puts this film on another page (ADR-0026): an iframe of /embed/….
import { Check, Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SITE_URL } from "@/config";

export function EmbedButton() {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<string>();
  // Read after mount: the server render and the first browser render must agree.
  useEffect(() => {
    const m = /^\/story\/([^/]+)\/([^/]+)/.exec(window.location.pathname);
    if (!m) return;
    const title = document.title.replace(/"/g, "&quot;");
    setCode(
      `<iframe src="${SITE_URL}/embed/${m[1]}/${m[2]}" width="800" height="450" style="border:0;border-radius:12px;max-width:100%" allow="fullscreen" loading="lazy" title="${title}"></iframe>`,
    );
  }, []);
  if (!code) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this code", code);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Embed code copied" : "Copy the code to embed this film on a page"}
      className="grid size-9 place-items-center rounded-lg border border-transparent text-dust/45 transition hover:text-dust/80"
    >
      {copied ? <Check size={16} className="text-dust" /> : <Code2 size={16} />}
    </button>
  );
}
