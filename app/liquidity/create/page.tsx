"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import { useRouter } from "next/navigation";
import { CONTRACTS } from "@/app/lib/contractAddresses";
import { TOKENS } from "@/app/lib/tokens";
import tokenABI from "@/app/lib/tokenABI.json";
import routerABI from "@/app/lib/routerABI.json";
import { fetchTokenMetadata } from "@/app/lib/fetchTokenMetadata";
import { v4 as uuidv4 } from "uuid";

type Note = { id: string; type: "success" | "error" | "info"; msg: string };
type TokenMeta = { address: string; symbol: string; name: string; isNative?: boolean };

export default function CreatePoolPage() {
  const routerNav = useRouter();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [tokenA, setTokenA] = useState<TokenMeta>(TOKENS[0]);
  const [tokenB, setTokenB] = useState<TokenMeta>(TOKENS[1]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [selecting, setSelecting] = useState<"A" | "B" | null>(null);
  const [tokenSearch, setTokenSearch] = useState("");
  const [searchResult, setSearchResult] = useState<TokenMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  const push = (type: Note["type"], msg: string) => setNotes((x) => [...x, { id: uuidv4(), type, msg }]);
  const close = (id: string) => setNotes((x) => x.filter((n) => n.id !== id));
  const readProvider = useMemo(() => new ethers.JsonRpcProvider("http://devnet-rpc.mocachain.org"), []);

  const getSigner = async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    return new ethers.BrowserProvider(walletClient.transport).getSigner();
  };

  const handleSelectToken = (meta: TokenMeta) => {
    if (selecting === "A") {
      if (meta.symbol === tokenB.symbol) setTokenB(tokenA);
      setTokenA(meta);
    } else {
      if (meta.symbol === tokenA.symbol) setTokenA(tokenB);
      setTokenB(meta);
    }
    setSelecting(null);
  };

  const onCreatePool = async () => {
    if (!address || !walletClient) return push("info", "Please connect your wallet.");
    setBusy(true);
    try {
      const signer = await getSigner();
      const factory = new ethers.Contract(CONTRACTS.FACTORY, ["function getPair(address,address) view returns (address)", "function createPair(address,address) returns (address)"], signer);
      const router = new ethers.Contract(CONTRACTS.ROUTER, routerABI, signer);

      const aAddr = tokenA.isNative ? CONTRACTS.WMOCA : tokenA.address;
      const bAddr = tokenB.isNative ? CONTRACTS.WMOCA : tokenB.address;

      const existingPair = await factory.getPair(aAddr, bAddr);
      if (existingPair === ethers.ZeroAddress) {
        push("info", "Creating new pair contract...");
        await (await factory.createPair(aAddr, bAddr)).wait();
      }

      const amtA = ethers.parseEther(amountA);
      const amtB = ethers.parseEther(amountB);

      // Handle MOCA vs ERC20 Logic
      if (tokenA.isNative || tokenB.isNative) {
        const token = tokenA.isNative ? bAddr : aAddr;
        const tAmt = tokenA.isNative ? amtB : amtA;
        const mAmt = tokenA.isNative ? amtA : amtB;
        
        const tContract = new ethers.Contract(token, tokenABI, signer);
        await (await tContract.approve(CONTRACTS.ROUTER, tAmt)).wait();
        await (await router.addLiquidityMOCA(token, tAmt, address, { value: mAmt })).wait();
      } else {
        const tA = new ethers.Contract(aAddr, tokenABI, signer);
        const tB = new ethers.Contract(bAddr, tokenABI, signer);
        await (await tA.approve(CONTRACTS.ROUTER, amtA)).wait();
        await (await tB.approve(CONTRACTS.ROUTER, amtB)).wait();
        await (await router.addLiquidity(aAddr, bAddr, amtA, amtB, address)).wait();
      }

      push("success", "Liquidity provisioned successfully!");
      routerNav.push("/liquidity");
    } catch (e: any) {
      push("error", "Transaction failed. Please check reserves and try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col items-center pt-10">
      <div className="w-full max-w-[480px] bg-[#111] border border-gray-800 p-8 rounded-[32px] shadow-2xl">
        <h1 className="text-2xl font-bold mb-2">Create Pool</h1>
        <p className="text-gray-500 text-sm mb-8">Initialize a new liquidity pair and set the starting price.</p>

        <TokenInput label="Token A" meta={tokenA} amount={amountA} setAmount={setAmountA} onSelect={() => setSelecting("A")} />
        <div className="h-4" />
        <TokenInput label="Token B" meta={tokenB} amount={amountB} setAmount={setAmountB} onSelect={() => setSelecting("B")} />

        <button disabled={busy} onClick={onCreatePool} className="w-full bg-white text-black mt-8 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50">
          {busy ? "Processing..." : "Supply Liquidity"}
        </button>
      </div>
      {/* Notifications simplified for neutral theme */}
    </div>
  );
}

function TokenInput({ label, meta, amount, setAmount, onSelect }: any) {
  return (
    <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-transparent focus-within:border-gray-700">
      <div className="flex justify-between text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">
        <span>{label}</span>
        <button onClick={onSelect} className="text-white hover:underline">{meta.symbol} ▾</button>
      </div>
      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" className="bg-transparent text-2xl w-full outline-none" />
    </div>
  );
}