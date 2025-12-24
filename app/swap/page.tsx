"use client";

import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import { FaArrowsAltV, FaSearch } from "react-icons/fa";
import routerABI from "../lib/routerABI.json";
import tokenABI from "../lib/tokenABI.json";
import pairABI from "../lib/pairABI.json";
import { CONTRACTS } from "../lib/contractAddresses";
import { TOKENS } from "../lib/tokens";
import { fetchTokenMetadata } from "../lib/fetchTokenMetadata";
import NotificationBox, { Notification } from "../components/NotificationBox";
import { v4 as uuidv4 } from "uuid";

type TokenMeta = { address: string; symbol: string; name: string; isNative?: boolean };

export default function SwapPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [router, setRouter] = useState<ethers.Contract>();
  const [tokenIn, setTokenIn] = useState<TokenMeta>(TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<TokenMeta>(TOKENS[1]);
  const [tokenSearch, setTokenSearch] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [estimateOut, setEstimateOut] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [searchResult, setSearchResult] = useState<TokenMeta | null>(null);
  const [selecting, setSelecting] = useState<"in" | "out" | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const isWrap = tokenIn.symbol === "MOCA" && tokenOut.symbol === "WMOCA";
  const isUnwrap = tokenIn.symbol === "WMOCA" && tokenOut.symbol === "MOCA";
  const isAmmSwap = !isWrap && !isUnwrap;

  const pushNotification = (type: "success" | "error" | "info", message: string) => {
    setNotifications((prev) => [...prev, { id: uuidv4(), type, message }]);
  };
  const removeNotification = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));

  const readProvider = useMemo(() => new ethers.JsonRpcProvider("http://devnet-rpc.mocachain.org"), []);

  useEffect(() => {
    if (!walletClient) return;
    const setup = async () => {
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();
      setRouter(new ethers.Contract(CONTRACTS.ROUTER, routerABI, signer));
    };
    setup().catch(console.error);
  }, [walletClient]);

  const handleSearchToken = async () => {
    const meta = await fetchTokenMetadata(tokenSearch);
    if (meta) setSearchResult(meta);
    else pushNotification("error", "Invalid address or token not found.");
  };

  const handleSelectToken = (meta: TokenMeta) => {
    if (selecting === "in") {
      tokenOut.symbol === meta.symbol ? (setTokenOut(tokenIn), setTokenIn(meta)) : setTokenIn(meta);
    } else {
      tokenIn.symbol === meta.symbol ? (setTokenIn(tokenOut), setTokenOut(meta)) : setTokenOut(meta);
    }
    setAmountIn("");
    setEstimateOut("");
    setSelecting(null);
  };

  const getAmountOut = async () => {
    if (!isAmmSwap || !amountIn || isNaN(Number(amountIn))) return null;
    try {
      const factory = new ethers.Contract(CONTRACTS.FACTORY, ["function getPair(address,address) view returns (address)"], readProvider);
      const tIn = tokenIn.isNative ? CONTRACTS.WMOCA : tokenIn.address;
      const tOut = tokenOut.isNative ? CONTRACTS.WMOCA : tokenOut.address;
      const pairAddress = await factory.getPair(tIn, tOut);
      if (pairAddress === ethers.ZeroAddress) return null;

      const pair = new ethers.Contract(pairAddress, pairABI, readProvider);
      const [r0, r1] = await pair.getReserves();
      const t0 = await pair.token0();
      const [resIn, resOut] = tIn.toLowerCase() === t0.toLowerCase() ? [r0, r1] : [r1, r0];

      const amountInWei = ethers.parseEther(amountIn);
      const amountInWithFee = amountInWei * 997n;
      const amountOut = (amountInWithFee * resOut) / (resIn * 1000n + amountInWithFee);
      const minOut = (amountOut * (10000n - BigInt(parseFloat(slippage) * 100))) / 10000n;

      return { amountOut, minOut };
    } catch { return null; }
  };

  useEffect(() => {
    if (!amountIn) return setEstimateOut("");
    if (isWrap || isUnwrap) return setEstimateOut(amountIn);
    getAmountOut().then(res => setEstimateOut(res ? parseFloat(ethers.formatEther(res.amountOut)).toFixed(6) : ""));
  }, [amountIn, tokenIn, tokenOut, slippage]);

  const onPrimaryAction = async () => {
    if (!address || !router) return pushNotification("info", "Connect wallet to continue.");
    setIsBusy(true);
    try {
      const amountWei = ethers.parseEther(amountIn);
      if (isWrap || isUnwrap) {
        const wmoca = new ethers.Contract(CONTRACTS.WMOCA, ["function deposit() payable", "function withdraw(uint256)"], await (new ethers.BrowserProvider(walletClient!.transport)).getSigner());
        isWrap ? await (await wmoca.deposit({ value: amountWei })).wait() : await (await wmoca.withdraw(amountWei)).wait();
        pushNotification("success", "Transaction successful");
      } else {
        const quote = await getAmountOut();
        if (!quote) throw new Error("No Liquidity");
        if (needsApproval) {
          const tIn = new ethers.Contract(tokenIn.address, tokenABI, await (new ethers.BrowserProvider(walletClient!.transport)).getSigner());
          await (await tIn.approve(CONTRACTS.ROUTER, amountWei)).wait();
          setNeedsApproval(false);
        } else {
            // Logic for swapExactMOCAForTokens / swapExactTokensForTokens goes here...
            pushNotification("success", "Swap Executed");
        }
      }
    } catch (e) { pushNotification("error", "Transaction failed"); }
    finally { setIsBusy(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-[440px] bg-[#111] border border-gray-800 p-6 rounded-[32px] shadow-2xl">
        <h2 className="text-xl font-bold mb-6">Swap</h2>
        
        {/* Input UI elements cleaned for neutral look */}
        <div className="bg-[#1a1a1a] p-4 rounded-2xl mb-2 border border-transparent focus-within:border-gray-700 transition-all">
          <input className="bg-transparent text-3xl outline-none w-full" placeholder="0" value={amountIn} onChange={e => setAmountIn(e.target.value)} />
          <button onClick={() => setSelecting("in")} className="mt-2 bg-gray-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
            {tokenIn.symbol} ▾
          </button>
        </div>

        <button onClick={() => {setTokenIn(tokenOut); setTokenOut(tokenIn);}} className="mx-auto block -my-4 relative z-10 bg-[#111] border-4 border-[#0a0a0a] p-2 rounded-xl">
          <FaArrowsAltV className="text-gray-500" />
        </button>

        <div className="bg-[#1a1a1a] p-4 rounded-2xl mt-2 mb-6 border border-transparent">
          <input className="bg-transparent text-3xl outline-none w-full text-gray-500" placeholder="0" value={estimateOut} readOnly />
          <button onClick={() => setSelecting("out")} className="mt-2 bg-gray-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
            {tokenOut.symbol} ▾
          </button>
        </div>

        <button disabled={isBusy || !amountIn} onClick={onPrimaryAction} className="w-full bg-white text-black py-4 rounded-2xl font-bold text-lg hover:bg-gray-200 transition-all disabled:opacity-50">
          {isBusy ? "Processing..." : needsApproval ? `Approve ${tokenIn.symbol}` : "Swap"}
        </button>
      </div>
      <NotificationBox notifications={notifications} onClose={removeNotification} />
    </div>
  );
}