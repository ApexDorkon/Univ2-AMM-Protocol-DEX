"use client";
import { useState } from "react";
import { TOKENS } from "../lib/tokens";
import { fetchTokenMetadata } from "../lib/fetchTokenMetadata";

export type TokenMeta = {
  address: string;
  symbol: string;
  name: string;
  isNative?: boolean;
};

type TokenSelectorProps = {
  onSelect: (token: TokenMeta) => void;
  onClose: () => void;
};

export default function TokenSelector({ onSelect, onClose }: TokenSelectorProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<TokenMeta | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    const token = await fetchTokenMetadata(query);
    setResult(token);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-[#1d1d1d] rounded-2xl p-5 w-[400px]">
        <div className="flex justify-between mb-3">
          <h3 className="text-lg font-semibold">Select Token</h3>
          <button onClick={onClose} className="text-gray-400">
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or paste address"
          className="w-full bg-[#2b2b2b] rounded-lg p-2 mb-3"
        />

        <button
          onClick={handleSearch}
          className="w-full bg-accent py-2 rounded-lg mb-3 hover:bg-accentHover"
        >
          {loading ? "Searching..." : "Search"}
        </button>

        {/* Popular Tokens */}
        <h4 className="text-sm text-gray-400 mb-2">Popular Tokens</h4>
        <div className="space-y-2">
          {TOKENS.map((t: TokenMeta) => (
            <div
              key={t.address}
              onClick={() => onSelect(t)}
              className="bg-[#2a2a2a] hover:bg-[#333] p-3 rounded-lg cursor-pointer flex justify-between"
            >
              <span className="font-semibold">{t.symbol}</span>
              <span className="text-gray-500">{t.name}</span>
            </div>
          ))}
        </div>

        {/* Search Result */}
        {result && (
          <div
            onClick={() => onSelect(result)}
            className="bg-[#2a2a2a] hover:bg-[#333] p-3 rounded-lg mt-3 cursor-pointer"
          >
            <span className="font-semibold">{result.symbol}</span>
            <p className="text-sm text-gray-400 truncate">{result.address}</p>
          </div>
        )}
      </div>
    </div>
  );
}