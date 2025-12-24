"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import "@rainbow-me/rainbowkit/styles.css";

const activeChain = {
  id: 5151,
  name: "Network",
  nativeCurrency: { name: "Native", symbol: "MOCA", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://devnet-rpc.mocachain.org"] },
  },
};

const config = getDefaultConfig({
  appName: "DEX Protocol",
  projectId: "YOUR_PROJECT_ID", 
  chains: [activeChain],
  transports: {
    [activeChain.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#ffffff', accentColorForeground: '#000000' })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}