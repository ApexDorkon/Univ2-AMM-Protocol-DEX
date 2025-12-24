"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { CONTRACTS } from "../lib/contractAddresses";
import pairABI from "../lib/pairABI.json";
import tokenABI from "../lib/tokenABI.json";
import { TOKENS } from "../lib/tokens";

type PoolRow = { key: string; aSym: string; bSym: string; pair: string; r0: string; r1: string; fee: string; };

export default function LiquidityPage() {
  const { address } = useAccount();
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  const readProvider = useMemo(() => new ethers.JsonRpcProvider("http://devnet-rpc.mocachain.org"), []);

  useEffect(() => {
    const loadPools = async () => {
      try {
        const factory = new ethers.Contract(CONTRACTS.FACTORY, ["function allPairsLength() view returns (uint256)", "function allPairs(uint256) view returns (address)"], readProvider);
        const length = Number(await factory.allPairsLength());
        const rows: PoolRow[] = [];

        for (let i = 0; i < length; i++) {
          const pairAddr = await factory.allPairs(i);
          const pair = new ethers.Contract(pairAddr, pairABI, readProvider);
          const [t0Addr, t1Addr, reserves, feeRaw] = await Promise.all([pair.token0(), pair.token1(), pair.getReserves(), pair.swapFee()]);
          
          const s0 = TOKENS.find(t => t.address.toLowerCase() === t0Addr.toLowerCase())?.symbol || "UNK";
          const s1 = TOKENS.find(t => t.address.toLowerCase() === t1Addr.toLowerCase())?.symbol || "UNK";

          rows.push({
            key: pairAddr,
            aSym: s0,
            bSym: s1,
            pair: pairAddr,
            r0: parseFloat(ethers.formatEther(reserves[0])).toFixed(2),
            r1: parseFloat(ethers.formatEther(reserves[1])).toFixed(2),
            fee: (Number(feeRaw) / 100).toFixed(2) + "%"
          });
        }
        setPools(rows);
      } finally { setLoading(false); }
    };
    loadPools();
  }, [readProvider]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-bold mb-2">Liquidity Pools</h1>
          <p className="text-gray-500">Provide assets to the protocol and earn yield from trading volume.</p>
        </div>
        <Link href="/liquidity/create" className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200">
          + Create Pool
        </Link>
      </div>

      <div className="bg-[#111] border border-gray-800 rounded-[32px] overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-gray-500 text-sm uppercase tracking-wider bg-[#1a1a1a]">
            <tr>
              <th className="px-8 py-4">Pair</th>
              <th className="px-8 py-4">Total Reserves</th>
              <th className="px-8 py-4">Fee Tier</th>
              <th className="px-8 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pools.map(pool => (
              <tr key={pool.key} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-8 py-6 font-bold">{pool.aSym} / {pool.bSym}</td>
                <td className="px-8 py-6 text-gray-400">{pool.r0} {pool.aSym} · {pool.r1} {pool.bSym}</td>
                <td className="px-8 py-6"><span className="bg-gray-800 px-2 py-1 rounded text-xs">{pool.fee}</span></td>
                <td className="px-8 py-6 text-right">
                  <Link href={`/liquidity/add?pair=${pool.pair}`} className="text-white hover:underline font-bold">Manage</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}