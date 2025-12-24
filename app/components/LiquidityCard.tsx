"use client";
import Link from "next/link";

export default function LiquidityCard({ pool }: { pool: any }) {
  return (
    <div className="flex justify-between items-center px-4 py-4 hover:bg-[#222] rounded-xl transition">
      <div>
        <h3 className="font-semibold text-white">{pool.pair}</h3>
        <p className="text-xs text-gray-500">Earn fees by providing liquidity</p>
      </div>
      <div className="text-sm text-gray-300 w-[80px] text-center">{pool.apr}</div>
      <div className="text-sm text-gray-300 w-[90px] text-center">{pool.tvl}</div>
      <div className="text-sm text-gray-300 w-[100px] text-center">{pool.volume24h}</div>
      <div className="text-sm text-gray-300 w-[70px] text-center">{pool.feeTier}</div>
      <Link
        href={`/liquidity/create?a=${encodeURIComponent(pool.pair.split(" / ")[0])}&b=${encodeURIComponent(pool.pair.split(" / ")[1])}`}
        className="bg-accent hover:bg-accentHover px-4 py-1.5 rounded-lg text-xs font-semibold"
      >
        Add
      </Link>
    </div>
  );
}