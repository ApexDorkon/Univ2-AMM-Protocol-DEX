import { CONTRACTS } from "./contractAddresses";

export const TOKENS = [
  { symbol: "MOCA", name: "Native MOCA", address: "native", isNative: true },
  { symbol: "IUSDC", name: "IUSDC", address: CONTRACTS.IUSDC },
  { symbol: "WMOCA", name: "Wrapped MOCA", address: CONTRACTS.WMOCA },
];