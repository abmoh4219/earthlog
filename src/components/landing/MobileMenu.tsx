"use client";

// Phones: the nav's sections behind one button (the bar has room only for the essentials).
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close the menu" : "Open the menu"}
        className="grid size-9 place-items-center rounded-full text-dust/75 hover:bg-moon/6 hover:text-moon"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full border-b border-moon/8 bg-night px-5 py-3 shadow-2xl">
          <ul className="grid grid-cols-2 gap-1">
            {[...links, { href: "/yours", label: "Yours" }].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-xl px-3 py-2.5 text-[15px] ${path === l.href ? "bg-moon/8 text-moon" : "text-dust/80 hover:bg-moon/5 hover:text-moon"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
