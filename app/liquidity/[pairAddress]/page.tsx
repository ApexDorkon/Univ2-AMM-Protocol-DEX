"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/app/lib/contractAddresses";
import pairABI from "@/app/lib/pairABI.json";
import tokenABI from "@/app/lib/tokenABI.json";

export default function PoolDetailsPage() {
  const { pair: pairAddr } = useParams();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [lpBalance, setLpBalance] = useState("0");
  const [fees, setFees] = useState(["0", "0"]);
  const [removeAmt, setRemoveAmt] = useState("");

  const readProvider = useMemo(() => new ethers.JsonRpcProvider("http://devnet-rpc.mocachain.org"), []);

  const loadDetails = async () => {
    if (!address) return;
    const pair = new ethers.Contract(pairAddr as string, pairABI, readProvider);
    const [bal, pending] = await Promise.all([pair.balanceOf(address), pair.pendingFees(address)]);
    setLpBalance(ethers.formatEther(bal));
    setFees([ethers.formatEther(pending[0]), ethers.formatEther(pending[1])]);
  };

  useEffect(() => { loadDetails(); }, [address, readProvider]);

  const handleClaim = async () => {
    const signer = await new ethers.BrowserProvider(walletClient!.transport).getSigner();
    const pair = new ethers.Contract(pairAddr as string, ["function claimFees() external"], signer);
    await (await pair.claimFees()).wait();
    loadDetails();
  };

  return (
    <div className="max-w-4xl mx-auto py-10 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Position Overview */}
      <div className="bg-[#111] border border-gray-800 p-8 rounded-[32px]">
        <h2 className="text-xl font-bold mb-6">Your Position</h2>
        <div className="space-y-4">
            <div className="flex justify-between border-b border-gray-900 pb-2">
                <span className="text-gray-500">LP Tokens</span>
                <span className="font-mono">{parseFloat(lpBalance).toFixed(4)}</span>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-2xl">
                <span className="text-xs text-gray-500 uppercase font-bold">Unclaimed Fees</span>
                <div className="text-lg font-bold mt-1">{parseFloat(fees[0]).toFixed(4)} / {parseFloat(fees[1]).toFixed(4)}</div>
                <button onClick={handleClaim} className="mt-4 text-sm font-bold text-white underline">Claim All Fees</button>
            </div>
        </div>
      </div>

      {/* Remove Liquidity UI */}
      <div className="bg-[#111] border border-gray-800 p-8 rounded-[32px]">
        <h2 className="text-xl font-bold mb-6">Remove Liquidity</h2>
        <input type="number" value={removeAmt} onChange={e => setRemoveAmt(e.target.value)} className="bg-[#1a1a1a] p-4 w-full rounded-2xl outline-none mb-4" placeholder="Amount to remove" />
        <button className="w-full bg-red-600 py-4 rounded-2xl font-bold">Burn LP & Withdraw Assets</button>
      </div>
    </div>
  );
}