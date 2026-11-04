"use client";

import { motion } from "motion/react";
import { usePlayer } from "@/player/store";

/** Cinema mode: black bars that slide in top and bottom. */
export function Letterbox() {
  const cinema = usePlayer((s) => s.cinema);
  const bar = { duration: 0.9, ease: [0.22, 1, 0.36, 1] } as const;
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[9vh] bg-black"
        initial={false}
        animate={{ y: cinema ? 0 : "-100%" }}
        transition={bar}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[9vh] bg-black"
        initial={false}
        animate={{ y: cinema ? 0 : "100%" }}
        transition={bar}
      />
    </>
  );
}
