"use client";

// The controls and cards over the Now globe (ADR-0022): which layers show, "Surprise me", and
// what was clicked: an earthquake, a natural event, or a country's pulse.
import { ArrowUpRight, Shuffle, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { NATURE_COLOR } from "@/globe/front";
import { countryName } from "@/scene/geo";
import { KIND_LABEL, type LiveEvent, type LiveFile, type LiveQuake, quakeLine } from "@/scene/live";
import { ago } from "@/scene/now";
import { type Pulse, pulseIsQuiet } from "@/scene/pulse";

export interface Layers {
  news: boolean;
  quakes: boolean;
  nature: boolean;
}

export type Selection =
  | { kind: "quake"; quake: LiveQuake }
  | { kind: "event"; event: LiveEvent }
  | { kind: "country"; pulse: Pulse };

const SODIUM = "#ffb547";
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Chip({
  on,
  color,
  label,
  count,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${on ? "bg-moon/12 text-moon" : "text-dust/50 hover:text-moon"}`}
    >
      <span
        className="size-2 rounded-full"
        style={{ background: on ? color : "transparent", boxShadow: `inset 0 0 0 1.5px ${color}` }}
      />
      {label}
      {count !== undefined && <span className="text-dust/40 tabular-nums">{count}</span>}
    </button>
  );
}

export function EarthControls({
  live,
  layers,
  setLayers,
  onSurprise,
  canSurprise,
}: {
  live: LiveFile | undefined;
  layers: Layers;
  setLayers: (l: Layers) => void;
  onSurprise: () => void;
  canSurprise: boolean;
}) {
  const nature = live?.events.length ?? 0;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
      <div className="glass pointer-events-auto flex flex-wrap items-center gap-0.5 rounded-full p-1">
        <Chip
          on={layers.news}
          color={SODIUM}
          label="News"
          onClick={() => setLayers({ ...layers, news: !layers.news })}
        />
        {live && (
          <Chip
            on={layers.quakes}
            color={NATURE_COLOR.quake}
            label="Earthquakes"
            count={live.quakes.length}
            onClick={() => setLayers({ ...layers, quakes: !layers.quakes })}
          />
        )}
        {live && nature > 0 && (
          <Chip
            on={layers.nature}
            color={NATURE_COLOR.storm}
            label="Storms and fires"
            count={nature}
            onClick={() => setLayers({ ...layers, nature: !layers.nature })}
          />
        )}
      </div>
      {canSurprise && (
        <button
          type="button"
          onClick={onSurprise}
          className="glass pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-sodium transition-colors hover:text-[#ffc46e]"
        >
          <Shuffle size={14} aria-hidden />
          Surprise me
        </button>
      )}
    </div>
  );
}

function Card({
  label,
  title,
  onClose,
  children,
}: {
  label: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="glass pointer-events-auto absolute inset-x-3 bottom-3 max-h-[60%] overflow-y-auto rounded-2xl px-5 py-4 sm:right-auto sm:w-[380px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-dust/55">{label}</p>
          <h2 className="mt-1 font-serif text-xl leading-snug text-moon">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 rounded-full p-1 text-dust/50 hover:bg-moon/8 hover:text-moon"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 space-y-3 text-sm text-dust/75">{children}</div>
    </div>
  );
}

const Source = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 text-xs text-dust/55 hover:text-moon"
  >
    {children}
    <ArrowUpRight size={12} />
  </a>
);

export function SelectionCard({
  selection,
  now,
  onClose,
  onStory,
}: {
  selection: Selection;
  now: number;
  onClose: () => void;
  onStory: (id: string) => void;
}) {
  if (selection.kind === "quake") {
    const q = selection.quake;
    return (
      <Card label={`Earthquake · ${ago(q.t, now)}`} title={q.place} onClose={onClose}>
        <p>
          {quakeLine(q)}, at {q.t.slice(11, 16)} UTC on {day(q.t)}.
        </p>
        <Source href={q.url}>USGS event page</Source>
      </Card>
    );
  }
  if (selection.kind === "event") {
    const e = selection.event;
    return (
      <Card label={KIND_LABEL[e.kind]} title={e.title} onClose={onClose}>
        <p>
          Last position reported {day(e.t)}
          {e.size ? `, ${e.size}` : ""}, by {e.agency}.
        </p>
        <Source href={e.url}>NASA EONET event</Source>
      </Card>
    );
  }
  const p = selection.pulse;
  const name = countryName(p.country);
  return (
    <Card label="Country pulse" title={name} onClose={onClose}>
      {pulseIsQuiet(p) && (
        <p className="text-dust/55">
          Nothing placed in {name} in this window: no outlet&apos;s headline, earthquake or open
          natural event, and no film in the last week.
        </p>
      )}
      {p.news.length > 0 && (
        <section>
          <h3 className="text-xs text-dust/50">In the news</h3>
          <ul className="mt-1 space-y-1.5">
            {p.news.slice(0, 5).map((s) => (
              <li key={s.cluster.id}>
                <button
                  type="button"
                  onClick={() => onStory(s.cluster.id)}
                  className="text-left leading-snug text-dust/85 hover:text-moon"
                >
                  {s.cluster.title}
                  {s.cluster.nowFilm && <span className="text-sodium"> · Film</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(p.quakes.length > 0 || p.events.length > 0) && (
        <section>
          <h3 className="text-xs text-dust/50">The ground and the sky</h3>
          <ul className="mt-1 space-y-1 text-[13px]">
            {p.quakes.slice(0, 4).map((q) => (
              <li key={q.id}>
                <a href={q.url} target="_blank" rel="noreferrer" className="hover:text-moon">
                  {quakeLine(q)} · {ago(q.t, now)}
                </a>
              </li>
            ))}
            {p.events.slice(0, 3).map((e) => (
              <li key={e.id}>
                <a href={e.url} target="_blank" rel="noreferrer" className="hover:text-moon">
                  {e.title} · last fix {day(e.t)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.films.length > 0 && (
        <section>
          <h3 className="text-xs text-dust/50">Earthlog films from {name}, last week</h3>
          <ul className="mt-1 space-y-1 text-[13px]">
            {p.films.map((f) => (
              <li key={`${f.date}/${f.slug}`}>
                <Link href={`/story/${f.date}/${f.slug}`} className="hover:text-moon">
                  {day(f.date)} · {f.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
