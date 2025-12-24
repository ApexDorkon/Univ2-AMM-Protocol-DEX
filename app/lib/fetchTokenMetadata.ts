// /app/lib/fetchTokenMetadata.ts
import { ethers } from "ethers";

export async function fetchTokenMetadata(address: string) {
  try {
    if (!ethers.isAddress(address)) return null;

    const rpc =
      typeof window !== "undefined"
        ? window.location.origin + "/api/rpc"
        : "https://rpc.moca.network"; // fallback
    const provider = new ethers.JsonRpcProvider(rpc);

    // minimal ABI to fetch metadata, with bytes32 fallbacks
    const abi = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function name() view returns (bytes32)",
      "function symbol() view returns (bytes32)",
    ];

    const token = new ethers.Contract(address, abi, provider);

    let name: string | undefined;
    let symbol: string | undefined;
    let decimals: number | undefined;

    // --- name ---
    try {
      name = await token.name();
      if (ethers.isBytesLike(name)) name = ethers.decodeBytes32String(name);
    } catch {
      name = "Unknown";
    }

    // --- symbol ---
    try {
      symbol = await token.symbol();
      if (ethers.isBytesLike(symbol)) symbol = ethers.decodeBytes32String(symbol);
    } catch {
      symbol = "???";
    }

    // --- decimals ---
    try {
      decimals = await token.decimals();
    } catch {
      decimals = 18; // fallback to 18 if missing
    }

    return {
      address: ethers.getAddress(address),
      name: name || "Unknown",
      symbol: symbol || "???",
      decimals,
      isNative: false,
    };
  } catch (err) {
    console.error("fetchTokenMetadata error:", err);
    return null;
  }
}