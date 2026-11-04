"use client";

import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { usePlayer } from "@/player/store";
import type { Evidence, Panel } from "@/scene/schema";
import { ms } from "@/scene/schema";

/**
 * Chart panels of a story film. A panel builds when its chapter begins and leaves when it
 * ends; every value carries a citation chip (hover for the evidence).
 */
export function Panels() {
  const bundle = usePlayer((s) => s.bundle);
  // Re-render only when the set of visible panels changes.
  const visible = usePlayer((s) =>
    (s.bundle?.scene.panels ?? [])
      .filter((p) => s.clock.t >= ms(p.t) && (!p.until || s.clock.t < ms(p.until)))
      .map((p) => p.id)
      .join("|"),
  );
  const evidence = useMemo(() => new Map(bundle?.evidence.map((e) => [e.id, e])), [bundle]);
  const panels = (bundle?.scene.panels ?? []).filter((p) => visible.split("|").includes(p.id));

  return (
    <div className="pointer-events-none absolute top-[calc(9vh+8.5rem)] right-6 z-20 hidden w-[340px] flex-col gap-3 md:flex">
      <AnimatePresence mode="popLayout">
        {panels.map((p) => (
          <motion.section
            key={p.id}
            layout
            initial={{ opacity: 0, x: 28, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 18, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass pointer-events-auto rounded-2xl p-4"
          >
            <h2 className="font-mono text-[10px] tracking-[0.28em] text-ice/60 uppercase">
              {p.title}
            </h2>
            <PanelBody panel={p} evidence={evidence} />
            {p.note && (
              <p className="mt-3 border-t border-ice/10 pt-2 text-[10px] leading-snug text-ice/45">
                {p.note}
              </p>
            )}
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Chip({ ids, evidence }: { ids: string[]; evidence: Map<string, Evidence> }) {
  const title = ids.map((id) => evidence.get(id)?.label ?? id).join("\n");
  return (
    <sup
      title={title}
      className="ml-1 cursor-help rounded border border-ice/30 bg-ice/10 px-1 font-mono text-[9px] text-ice"
    >
      {ids.length}
    </sup>
  );
}

function PanelBody({ panel, evidence }: { panel: Panel; evidence: Map<string, Evidence> }) {
  if (panel.kind === "facts") {
    return (
      <dl className="mt-3 space-y-2">
        {panel.items.map((item, i) => (
          <motion.div
            key={`${item.label}:${item.cites.join(",")}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="shrink-0 text-xs text-ice/55">{item.label}</dt>
            <dd className="text-right text-sm text-frost">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-ice underline-offset-2 hover:underline"
                >
                  {item.text ?? "Open"}
                  <ExternalLink size={11} />
                </a>
              ) : (
                item.text
              )}
              <Chip ids={item.cites} evidence={evidence} />
            </dd>
          </motion.div>
        ))}
      </dl>
    );
  }

  if (panel.kind === "bars") {
    const max = Math.max(...panel.items.map((i) => i.value), 1);
    return (
      <ul className="mt-3 space-y-2">
        {panel.items.map((item, i) => (
          <li key={`${item.label}:${item.cites.join(",")}`}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-frost/85">{item.label}</span>
              <span className="font-mono text-frost tabular-nums">
                {item.text ?? item.value.toLocaleString("en-GB")}
                <Chip ids={item.cites} evidence={evidence} />
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ice/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: item.color ?? "var(--color-ice)" }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return <LineChart panel={panel} evidence={evidence} />;
}

const W = 300;
const H = 110;

function LineChart({
  panel,
  evidence,
}: {
  panel: Extract<Panel, { kind: "line" }>;
  evidence: Map<string, Evidence>;
}) {
  const max = Math.max(...panel.series.flatMap((s) => s.points.map((p) => p.y)), 1);
  const n = Math.max(...panel.series.map((s) => s.points.length));
  const x = (i: number) => (i / Math.max(1, n - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 8);
  const first = panel.series[0]?.points[0]?.x;
  const last = panel.series[0]?.points.at(-1)?.x;
  const mark = panel.mark;

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full overflow-visible"
        role="img"
        aria-label={panel.title}
      >
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="rgb(154 217 255 / 0.1)"
          />
        ))}
        {panel.series.map((s, k) => {
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.y)}`).join("");
          const color = s.color ?? "var(--color-ice)";
          return (
            <g key={s.label}>
              {k === 0 && (
                <motion.path
                  d={`${d}L${x(s.points.length - 1)},${H}L0,${H}Z`}
                  fill={color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.12 }}
                  transition={{ delay: 0.9, duration: 0.8 }}
                />
              )}
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={k === 0 ? 2 : 1.3}
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.2 + k * 0.25, duration: 1.4, ease: "easeInOut" }}
              />
            </g>
          );
        })}
        {mark !== undefined && panel.series[0]?.points[mark] && (
          <motion.circle
            cx={x(mark)}
            cy={y(panel.series[0].points[mark]?.y ?? 0)}
            r={4}
            fill={panel.series[0].color ?? "var(--color-ice)"}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 14 }}
          />
        )}
        <text x={0} y={10} className="fill-ice/45 font-mono text-[9px]">
          {Math.round(max).toLocaleString("en-GB")}
        </text>
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-ice/40">
        <span>{first}</span>
        <span>{panel.unit}</span>
        <span>{last}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {panel.series.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[11px] text-frost/80">
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: s.color ?? "var(--color-ice)" }}
            />
            <span className="truncate">{s.label}</span>
            <Chip ids={s.cites} evidence={evidence} />
          </li>
        ))}
      </ul>
    </div>
  );
}
