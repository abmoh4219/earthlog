"use client";

// The reader's filters on Now (ADR-0023): where (regions), what (topics), and "For you", the
// topics and regions they follow, chosen once and remembered in their browser.
import { Check, Star } from "lucide-react";
import type { ForYou } from "@/lib/for-you";
import { REGIONS, type Region } from "@/scene/regions";
import { TOPIC_LABEL, TOPICS, type Topic } from "@/scene/topics";

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-2.5 py-1 whitespace-nowrap transition-colors ${on ? "bg-moon/12 text-moon" : "text-dust/55 hover:bg-moon/5 hover:text-moon"}`;

export function RegionChips({
  counts,
  region,
  setRegion,
}: {
  counts: Map<Region, number>;
  region: Region | undefined;
  setRegion: (r: Region | undefined) => void;
}) {
  const present = REGIONS.filter((r) => (counts.get(r) ?? 0) > 0 || r === region);
  if (present.length < 2) return null;
  return (
    <fieldset className="-mx-1 mt-3 flex min-w-0 gap-1 overflow-x-auto text-[13px] [scrollbar-width:none] sm:flex-wrap">
      <legend className="sr-only">Where</legend>
      <button
        type="button"
        aria-pressed={!region}
        onClick={() => setRegion(undefined)}
        className={chip(!region)}
      >
        Everywhere
      </button>
      {present.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={r === region}
          onClick={() => setRegion(r === region ? undefined : r)}
          className={chip(r === region)}
        >
          {r} <span className="text-dust/40 tabular-nums">{counts.get(r) ?? 0}</span>
        </button>
      ))}
    </fieldset>
  );
}

export function TopicChips({
  topics,
  topic,
  setTopic,
  forYou,
  forYouOn,
  onForYou,
}: {
  topics: [Topic, number][];
  topic: Topic | undefined;
  setTopic: (t: Topic | undefined) => void;
  forYou: ForYou;
  forYouOn: boolean;
  onForYou: () => void;
}) {
  return (
    <fieldset className="-mx-1 mt-2 flex min-w-0 gap-1 overflow-x-auto text-[13px] [scrollbar-width:none] sm:flex-wrap">
      <legend className="sr-only">Topics</legend>
      <button
        type="button"
        aria-pressed={!topic && !forYouOn}
        onClick={() => setTopic(undefined)}
        className={chip(!topic && !forYouOn)}
      >
        All
      </button>
      <button
        type="button"
        aria-pressed={forYouOn}
        onClick={onForYou}
        className={`${chip(forYouOn)} flex items-center gap-1`}
        title={
          forYou.topics.length || forYou.regions.length
            ? "The topics and regions you follow"
            : "Choose the topics and regions you follow"
        }
      >
        <Star size={12} className={forYouOn ? "fill-sodium text-sodium" : ""} aria-hidden />
        For you
      </button>
      {topics.map(([t, n]) => (
        <button
          key={t}
          type="button"
          aria-pressed={t === topic}
          onClick={() => setTopic(t === topic ? undefined : t)}
          className={chip(t === topic)}
        >
          {TOPIC_LABEL[t]} <span className="text-dust/40 tabular-nums">{n}</span>
        </button>
      ))}
    </fieldset>
  );
}

/** Choose what to follow: any topics, any regions. Saved on "Done". */
export function ForYouChooser({
  value,
  onChange,
  onDone,
}: {
  value: ForYou;
  onChange: (v: ForYou) => void;
  onDone: () => void;
}) {
  const toggle = <T,>(list: T[], x: T) =>
    list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
  return (
    <div className="mt-3 rounded-2xl border border-moon/10 bg-moon/[0.03] p-4">
      <p className="text-sm text-moon">What do you follow?</p>
      <p className="mt-1 text-xs text-dust/50">
        Kept in this browser only. Pick any topics and regions; leave one group empty for all.
      </p>
      <p className="mt-3 text-xs text-dust/55">Topics</p>
      <div className="-mx-1 mt-1 flex flex-wrap gap-1 text-[13px]">
        {TOPICS.map((t) => {
          const on = value.topics.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...value, topics: toggle(value.topics, t) })}
              className={`${chip(on)} flex items-center gap-1`}
            >
              {on && <Check size={12} aria-hidden />}
              {TOPIC_LABEL[t]}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-dust/55">Regions</p>
      <div className="-mx-1 mt-1 flex flex-wrap gap-1 text-[13px]">
        {REGIONS.map((r) => {
          const on = value.regions.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...value, regions: toggle(value.regions, r) })}
              className={`${chip(on)} flex items-center gap-1`}
            >
              {on && <Check size={12} aria-hidden />}
              {r}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onDone}
        className="mt-4 rounded-full bg-sodium px-4 py-1.5 text-sm font-medium text-void hover:bg-[#ffc46e]"
      >
        Done
      </button>
    </div>
  );
}
