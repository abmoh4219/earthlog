"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/player/store";
import { clockText } from "@/scene/format";
import { heldSample, stormAt } from "@/scene/layers";
import type { QuakeLayer, SignalLayer, SignalSeries, StormLayer } from "@/scene/schema";
import { ms } from "@/scene/schema";

const W = 220;
const H = 44;
/** Sparkline ceiling: 120% of normal, so small rises are visible but don't flatten drops. */
const TOP = 1.2;

/** The live readout: what each sensor says right now, against its own normal. */
export function DataPanel() {
  const bundle = usePlayer((s) => s.bundle);
  const open = usePlayer((s) => s.panel);
  if (!bundle) return null;
  const signal = bundle.layers.find((l): l is SignalLayer => l.kind === "outages");
  const quakes = bundle.layers.find((l): l is QuakeLayer => l.kind === "quakes");
  const storms = bundle.layers.find((l): l is StormLayer => l.kind === "storms");
  if (!signal && !quakes && !storms) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="panel"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="glass pointer-events-auto absolute top-[calc(9vh+7.5rem)] right-6 z-20 hidden w-[264px] rounded-2xl p-4 md:block"
        >
          {signal && <SignalBlock layer={signal} timezone={bundle.scene.timezone} />}
          {quakes && <QuakeBlock layer={quakes} />}
          {storms && <StormBlock layer={storms} />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function SignalBlock({ layer, timezone }: { layer: SignalLayer; timezone: string }) {
  const color = layer.tone === "loss" ? "var(--color-loss)" : "var(--color-attention)";
  return (
    <section>
      <h2 className="font-medium text-xs text-dust/60">Internet · vs normal</h2>
      <p className="mt-1 text-xs text-moon/80">{layer.label}</p>
      <ul className="mt-3 space-y-3">
        {layer.series.map((s) => (
          <SeriesRow key={s.code} series={s} color={color} timezone={timezone} />
        ))}
      </ul>
      <p className="mt-3 border-t border-dust/10 pt-2 text-[10px] leading-snug text-dust/45">
        {layer.baseline} Source: IODA, Georgia Tech.
      </p>
    </section>
  );
}

function SeriesRow({
  series,
  color,
  timezone,
}: {
  series: SignalSeries;
  color: string;
  timezone: string;
}) {
  // Re-render only when the held sample changes (every 10–30 scene minutes).
  const sampleT = usePlayer((s) => heldSample(series, s.clock.t)?.t ?? -1);
  const sample = sampleT >= 0 ? heldSample(series, sampleT) : null;
  const value = sample ? Math.round(sample.ratio * 100) : null;
  const drop = sample ? sample.ratio < 0.95 : false;

  const { line, area, gaps } = useMemo(() => sparkline(series), [series]);
  const i = sample ? (sample.t - ms(series.start)) / (series.step * 1000) : -1;
  const x = i >= 0 ? (i / Math.max(1, series.ratio.length - 1)) * W : -1;

  return (
    <li>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-moon">{series.name}</span>
        <span
          className={cn("font-mono text-xl tabular-nums transition-colors", !drop && "text-moon")}
          style={drop ? { color } : undefined}
        >
          {value === null ? "—" : `${value}%`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-11 w-full overflow-visible"
        role="img"
        aria-label={`${series.name}: ${value === null ? "no data" : `${value}% of normal`}`}
      >
        {/* 100% = normal */}
        <line
          x1={0}
          x2={W}
          y1={y(1)}
          y2={y(1)}
          stroke="rgb(212 205 191 / 0.25)"
          strokeDasharray="2 3"
        />
        <path d={area} fill={color} opacity={0.22} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
        {gaps.map((g) => (
          <rect key={g} x={g} y={0} width={2} height={H} fill="rgb(212 205 191 / 0.12)" />
        ))}
        {x >= 0 && (
          <>
            <line x1={x} x2={x} y1={0} y2={H} stroke="rgb(241 235 223 / 0.6)" strokeWidth={1} />
            <circle cx={x} cy={y(sample?.ratio ?? 1)} r={3} fill={color} />
          </>
        )}
      </svg>
      {sample && (
        <div className="mt-0.5 font-mono text-[10px] text-dust/40 tabular-nums">
          measured {clockText(sample.t, timezone).slice(0, 5)} local
        </div>
      )}
    </li>
  );
}

function y(ratio: number) {
  return H - (Math.min(ratio, TOP) / TOP) * H;
}

/**
 * Line path, plus an area between the line and "normal" (100%), so the shading is the
 * shortfall itself. Gaps break both instead of being bridged.
 */
function sparkline(series: SignalSeries) {
  const n = Math.max(1, series.ratio.length - 1);
  let line = "";
  let area = "";
  let runStart = -1;
  let lastX = 0;
  const gaps: number[] = [];
  series.ratio.forEach((r, i) => {
    const x = (i / n) * W;
    if (r === null) {
      gaps.push(x);
      if (runStart >= 0) area += `L${lastX},${y(1)}Z`;
      runStart = -1;
      return;
    }
    if (runStart < 0) {
      line += `M${x},${y(r)}`;
      area += `M${x},${y(1)}L${x},${y(r)}`;
      runStart = x;
    } else {
      line += `L${x},${y(r)}`;
      area += `L${x},${y(r)}`;
    }
    lastX = x;
  });
  if (runStart >= 0) area += `L${lastX},${y(1)}Z`;
  return { line, area, gaps };
}

function QuakeBlock({ layer }: { layer: QuakeLayer }) {
  const minute = usePlayer((s) => Math.floor(s.clock.t / 60_000));
  const happened = layer.quakes.filter((q) => ms(q.t) <= minute * 60_000 + 59_999);
  const largest = happened.reduce<number | null>(
    (m, q) => (m === null || q.mag > m ? q.mag : m),
    null,
  );
  return (
    <section className="mt-4 border-t border-dust/10 pt-3 first:mt-0 first:border-0 first:pt-0">
      <h2 className="font-medium text-xs text-dust/60">Earthquakes · USGS</h2>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="font-mono text-2xl text-moon tabular-nums">{happened.length}</div>
          <div className="text-[10px] text-dust/50">recorded so far</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl tabular-nums" style={{ color: "var(--color-energy)" }}>
            {largest === null ? "—" : `M${largest.toFixed(1)}`}
          </div>
          <div className="text-[10px] text-dust/50">largest</div>
        </div>
      </div>
    </section>
  );
}

function StormBlock({ layer }: { layer: StormLayer }) {
  // Storm fixes are 6-hourly; re-render every scene 10 minutes is plenty.
  const tick = usePlayer((s) => Math.floor(s.clock.t / 600_000));
  const t = tick * 600_000;
  const live = layer.storms.flatMap((s) => {
    const at = stormAt(s, t);
    return at ? [{ name: s.name, at }] : [];
  });
  return (
    <section className="mt-4 border-t border-dust/10 pt-3 first:mt-0 first:border-0 first:pt-0">
      <h2 className="font-medium text-xs text-dust/60">Storms · NASA EONET</h2>
      {live.length === 0 ? (
        <p className="mt-2 text-xs text-dust/50">No tracked storm at this moment.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {live.map(({ name, at }) => (
            <li key={name} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm text-moon">{name}</span>
              <span
                className="shrink-0 font-mono text-sm tabular-nums"
                style={{ color: "var(--color-energy)" }}
              >
                {at.windKt ? `${at.windKt} kt` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] leading-snug text-dust/45">
        Positions every 6 hours from the tracking agency; the marker moves in a straight line
        between them.
      </p>
    </section>
  );
}
