"use client";

import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { usePlayer } from "@/player/store";
import { parliamentSeats } from "@/scene/charts";
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
    <div
      className={`panel-stack ${panels.length ? "pointer-events-auto" : "pointer-events-none"} absolute top-[10rem] right-3 left-3 z-20 flex max-h-[30vh] flex-col gap-2 overflow-y-auto md:top-[calc(9vh+7rem)] md:right-4 md:bottom-[calc(9vh+5.25rem)] md:left-auto md:max-h-none md:w-[min(340px,30vw)] md:gap-2.5 md:pr-1 lg:right-6`}
    >
      <AnimatePresence mode="popLayout">
        {panels.map((p) => (
          <motion.section
            key={p.id}
            layout
            initial={{ opacity: 0, x: 28, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 18, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass shrink-0 rounded-2xl p-4 [@media(max-height:820px)]:p-3"
          >
            <h2 className="font-medium text-xs text-dust/60">{p.title}</h2>
            <PanelBody panel={p} evidence={evidence} />
            {p.note && (
              <p className="mt-3 border-t border-dust/10 pt-2 text-[10px] leading-snug text-dust/45 [@media(max-height:820px)]:mt-2">
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
      className="ml-1 cursor-help text-[10px] font-medium text-dust/45 tabular-nums transition hover:text-dust"
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
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-x-3"
          >
            <dt className="text-xs break-words text-dust/55">{item.label}</dt>
            <dd className="text-right text-sm break-words text-moon [@media(max-height:820px)]:text-xs">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-dust underline-offset-2 hover:underline"
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

  if (panel.kind === "seats") return <Parliament panel={panel} evidence={evidence} />;

  if (panel.kind === "bars") {
    const max = Math.max(...panel.items.map((i) => i.value), panel.marker?.value ?? 0, 1);
    const markerAt = panel.marker ? (panel.marker.value / max) * 100 : undefined;
    return (
      <ul className={`relative mt-3 space-y-2 ${panel.marker ? "mb-4" : ""}`}>
        {markerAt !== undefined && panel.marker && (
          <li
            aria-hidden
            className="pointer-events-none absolute -top-1 bottom-0 z-10 w-px bg-moon/60"
            style={{ left: `${markerAt}%` }}
          >
            <span className="absolute -bottom-4 -translate-x-1/2 font-mono text-[9px] whitespace-nowrap text-moon/70">
              {panel.marker.label}
            </span>
          </li>
        )}
        {panel.items.map((item, i) => (
          <li key={`${item.label}:${item.cites.join(",")}`}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-moon/85" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-mono text-moon tabular-nums">
                {item.text ?? item.value.toLocaleString("en-GB")}
                <Chip ids={item.cites} evidence={evidence} />
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dust/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: item.color ?? "var(--color-dust)" }}
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
            stroke="rgb(212 205 191 / 0.1)"
          />
        ))}
        {panel.series.map((s, k) => {
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.y)}`).join("");
          const color = s.color ?? "var(--color-dust)";
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
            fill={panel.series[0].color ?? "var(--color-dust)"}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 14 }}
          />
        )}
        <text x={0} y={10} className="fill-dust/45 font-mono text-[9px]">
          {Math.round(max).toLocaleString("en-GB")}
        </text>
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-dust/40">
        <span>{first}</span>
        <span>{panel.unit}</span>
        <span>{last}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {panel.series.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[11px] text-moon/80">
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: s.color ?? "var(--color-dust)" }}
            />
            <span className="truncate">{s.label}</span>
            <Chip ids={s.cites} evidence={evidence} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A parliament as a half circle of seats, filled left to right in party order. Row lengths
 * grow with the radius so the dots stay evenly spaced (the usual parliament diagram).
 */
function Parliament({
  panel,
  evidence,
}: {
  panel: Extract<Panel, { kind: "seats" }>;
  evidence: Map<string, Evidence>;
}) {
  const seats = useMemo(() => parliamentSeats(panel.total), [panel.total]);
  const colors: string[] = [];
  for (const item of panel.items)
    for (let k = 0; k < item.value; k++) colors.push(item.color ?? "var(--color-dust)");
  const Wd = 300;
  const Hd = 156;
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="w-full" role="img" aria-label={panel.title}>
        <motion.g
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "50% 100%" }}
        >
          {seats.dots.map((d, i) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: seats are positional and fixed for a panel
              key={i}
              cx={Wd / 2 + d.x * (Wd / 2 - 6)}
              cy={Hd - 4 - d.y * (Hd - 10)}
              r={seats.r * (Wd / 2 - 6)}
              fill={colors[i] ?? "rgb(212 205 191 / 0.12)"}
            />
          ))}
        </motion.g>
        {panel.majority && (
          <g>
            <line
              x1={Wd / 2}
              x2={Wd / 2}
              y1={Hd - 4 - 1.04 * (Hd - 10)}
              y2={Hd - 4 - 0.36 * (Hd - 10)}
              stroke="rgb(241 235 223 / 0.55)"
              strokeDasharray="2 3"
            />
            {/* In the arc's hollow centre: the number big, the meaning small. */}
            <text
              x={Wd / 2}
              y={Hd - 20}
              textAnchor="middle"
              className="fill-moon font-mono text-[18px]"
            >
              {panel.majority}
            </text>
            <text
              x={Wd / 2}
              y={Hd - 6}
              textAnchor="middle"
              className="fill-dust/60 font-mono text-[8px] tracking-wider uppercase"
            >
              for a majority
            </text>
          </g>
        )}
      </svg>
      <ul
        className={`mt-2 grid gap-x-3 gap-y-1 ${panel.items.length > 4 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {panel.items.map((item) => (
          <li
            key={`${item.label}:${item.cites.join(",")}`}
            className="flex min-w-0 items-center gap-1.5 text-[11px] text-moon/85"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: item.color ?? "var(--color-dust)" }}
            />
            <span className="min-w-0 truncate" title={item.label}>
              {item.label}
            </span>
            <span className="ml-auto shrink-0 font-mono tabular-nums">
              {item.text ?? item.value}
            </span>
            <Chip ids={item.cites} evidence={evidence} />
          </li>
        ))}
      </ul>
    </div>
  );
}
