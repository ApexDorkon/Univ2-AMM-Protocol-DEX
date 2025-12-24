"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import { CONTRACTS } from "@/app/lib/contractAddresses";
import pairABI from "@/app/lib/pairABI.json";
import tokenABI from "@/app/lib/tokenABI.json";
import routerABI from "@/app/lib/routerABI.json";

export default function AddLiquidityPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [busy, setBusy] = useState(false);

  // Mocking token context for brevity; in production, these come from URL params or state
  const [tokenA] = useState(TOKENS[0]);
  const [tokenB] = useState(TOKENS[1]);

  const readProvider = useMemo(() => new ethers.JsonRpcProvider("http://devnet-rpc.mocachain.org"), []);

  useEffect(() => {
    if (!amountA || isNaN(Number(amountA))) return;
    const fetchRatio = async () => {
        const factory = new ethers.Contract(CONTRACTS.FACTORY, ["function getPair(address,address) view returns (address)"], readProvider);
        const pairAddr = await factory.getPair(tokenA.address, tokenB.address);
        if (pairAddr === ethers.ZeroAddress) return;

        const pair = new ethers.Contract(pairAddr, pairABI, readProvider);
        const [r0, r1] = await pair.getReserves();
        const t0 = await pair.token0();
        const [resA, resB] = t0.toLowerCase() === tokenA.address.toLowerCase() ? [r0, r1] : [r1, r0];
        
        if (resA > 0n) {
            const quote = (ethers.parseEther(amountA) * resB) / resA;
            setAmountB(ethers.formatEther(quote));
        }
    };
    fetchRatio();
  }, [amountA, readProvider]);

  const onAddLiquidity = async () => {
    if (!walletClient) return;
    setBusy(true);
    try {
        const signer = await new ethers.BrowserProvider(walletClient.transport).getSigner();
        const router = new ethers.Contract(CONTRACTS.ROUTER, routerABI, signer);
        const amtA = ethers.parseEther(amountA);
        const amtB = ethers.parseEther(amountB);

        // Approval Logic... (Similar to Create Pool)
        await (await router.addLiquidity(tokenA.address, tokenB.address, amtA, amtB, address)).wait();
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col items-center pt-10">
      <div className="w-full max-w-[440px] bg-[#111] border border-gray-800 p-8 rounded-[32px] shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Add Liquidity</h1>
        <TokenInput label={`${tokenA.symbol} Amount`} amount={amountA} setAmount={setAmountA} meta={tokenA} />
        <div className="flex justify-center my-4 text-gray-600 font-bold">+</div>
        <TokenInput label={`${tokenB.symbol} Amount`} amount={amountB} setAmount={setAmountB} meta={tokenB} />
        
        <button onClick={onAddLiquidity} className="w-full bg-white text-black py-4 rounded-2xl font-bold mt-8">
            {busy ? "Executing..." : "Add Liquidity"}
        </button>
      </div>
    </div>
  );
}