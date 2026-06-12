"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Command Center", href: "/" },
    { name: "ScopeGuard", href: "/scopeguard" },
  ];

  return (
    <header className="flex items-center justify-between border-b border-[#1c1c1c] bg-[#0a0a0a] px-8 py-5">
      <div className="flex items-center gap-3 font-mono text-sm font-bold tracking-widest text-zinc-100">
        <div className="h-4 w-1 bg-[#f0a500]"></div>
        DEPLOYMENT OS
      </div>

      <nav className="flex items-center gap-2 bg-[#111111] p-1 rounded-lg border border-[#1c1c1c]">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`rounded-md px-4 py-2 text-xs font-mono tracking-wider transition-all duration-200 uppercase ${
                isActive
                  ? "bg-[#1a1a1a] text-[#f0a500] shadow-sm border border-[#2a2a2a]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-[#161616] border border-transparent"
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
