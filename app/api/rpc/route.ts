import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "RPC proxy active ✅" });
}

export async function POST(req: Request) {
  try {
    const body = await req.text();

    const rpcResponse = await fetch("http://devnet-rpc.mocachain.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "manual",
    });

    if (!rpcResponse.ok) {
      console.error("RPC request failed:", rpcResponse.status, rpcResponse.statusText);
      return NextResponse.json(
        { error: "RPC request failed", status: rpcResponse.status },
        { status: 500 }
      );
    }

    const data = await rpcResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("RPC proxy error:", error);
    return NextResponse.json({ error: "RPC proxy error" }, { status: 500 });
  }
}