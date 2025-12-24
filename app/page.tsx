"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FaExchangeAlt, FaWater, FaChartLine } from "react-icons/fa";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center z-10 px-4"
      >
        <h1 className="text-5xl sm:text-7xl font-bold mb-6 tracking-tight">
          Liquidity Protocol 💧
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          An institutional-grade AMM engine. Swap assets with minimal slippage, 
          manage automated liquidity pools, and leverage sub-second finality.
        </p>

        <div className="flex flex-wrap justify-center gap-6">
          <Link
            href="/swap"
            className="bg-white text-black px-10 py-3 rounded-full text-lg font-bold hover:bg-gray-200 transition-all shadow-lg shadow-white/5"
          >
            Enter App
          </Link>
          <Link
            href="/liquidity"
            className="bg-transparent border border-gray-700 text-white px-10 py-3 rounded-full text-lg font-bold hover:bg-white/10 transition-all"
          >
            Liquidity
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-24 max-w-6xl px-6 z-10">
        <FeatureCard
          icon={<FaExchangeAlt size={24} />}
          title="Swap"
          text="Trade assets using an optimized $x \cdot y = k$ invariant engine for deep liquidity."
        />
        <FeatureCard
          icon={<FaWater size={24} />}
          title="Pools"
          text="Earn trading fees by providing assets to decentralized, autonomous liquidity pools."
        />
        <FeatureCard
          icon={<FaChartLine size={24} />}
          title="Analytics"
          text="On-chain data integration for real-time tracking of reserves and volume."
        />
      </div>

      <footer className="mt-20 pb-10 text-gray-600 text-xs tracking-widest uppercase">
        Network Status: <span className="text-green-500">Connected</span>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string; }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-[#111] p-8 rounded-3xl border border-gray-800 hover:border-gray-600 transition-colors"
    >
      <div className="text-white mb-4 bg-gray-800 w-fit p-3 rounded-xl">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{text}</p>
    </motion.div>
  );
}