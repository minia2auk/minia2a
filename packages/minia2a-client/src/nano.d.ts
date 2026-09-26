// TypeScript type definitions for the Nano (XNO) settlement rail.
// minia2a-client/nano

import { CallOptions, CallResult } from "./index.js";

export interface NanoClientOptions {
  /** Nano account private key (64 hex chars) that pays per-call fees in Nano. */
  privateKey?: string;
  /** Nano RPC URL used to build (and where the sender requires it) announce the send block. */
  rpcUrl?: string;
  /** Nano work generation URL. */
  workGenerationUrl?: string;
  /** Optional EVM private key to also offer the USDC-on-Base rail. */
  evmPrivateKey?: string;
}

export interface NanoClient {
  /** x402 scheme identifier. */
  scheme: "exact";
  /** Network this client settles on. */
  network: "nano:mainnet";
  /** Asset it settles in. */
  asset: "XNO";
  /**
   * Call a service. POST /x402/<service-id>; a 402 challenge is settled in
   * Nano on nano:mainnet when the server offers that accept. The call
   * identifies this agent with the same persisted X-Agent-ID as the USDC rail.
   */
  call(service: string, params?: Record<string, any>, opts?: CallOptions): Promise<CallResult>;
}

/**
 * Create a minia2a client that settles in feeless Nano (XNO) on nano:mainnet,
 * optionally also carrying the USDC-on-Base rail. Loads the optional Nano
 * dependencies lazily: they are still installed by default, but a USDC-only
 * user never loads the Nano graph at runtime (and a missing optional dep
 * degrades to a clear named error, not an install-time abort).
 * @param opts - Nano wallet key and RPC configuration.
 * @returns a Promise for the Nano-settling client.
 */
export function createNanoClient(opts?: NanoClientOptions): Promise<NanoClient>;
