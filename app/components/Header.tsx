"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectWallet from "./ConnectWallet";

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Swap", href: "/swap" },
    { name: "Liquidity", href: "/liquidity" },
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-[#101010]/80 backdrop-blur-md border-b border-[#222] z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo / name */}
        <Link
          href="/"
          className="text-accent font-semibold text-lg tracking-wide hover:opacity-90 transition"
        >
          DEX
        </Link>

        {/* Navigation */}
        <nav className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-all ${
                pathname === item.href
                  ? "text-accent border-b-2 border-accent pb-1"
                  : "text-gray-400 hover:text-accent"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Wallet connect (wagmi / rainbowkit) */}
        <div className="ml-6">
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}