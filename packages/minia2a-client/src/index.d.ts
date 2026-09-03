// TypeScript type definitions for minia2a-client
// https://minia2a.uk | npm: minia2a-client

export interface CallOptions {
  /** HTTP method (default: POST) */
  method?: string;
  /** Extra headers */
  headers?: Record<string, string>;
  /** Raw request body (overrides params) */
  body?: string;
  /** Request timeout in ms (default: 60000) */
  timeout?: number;
  /** Use a free trial call instead of paying (requires a prior register()) */
  trial?: boolean;
}

export interface CallResult {
  ok: boolean;
  status?: number;
  error?: string;
  paymentRequired?: boolean;
  helpUrl?: string;
  [key: string]: any;
}

export interface RegisterResult {
  ok: boolean;
  status?: number;
  error?: string;
  wallet?: string;
  name?: string;
  message?: string;
  trialHint?: string;
  paymentGuide?: string;
}

export interface Service {
  id?: string;
  name?: string;
  priceCents?: number;
  price_cents?: number;
  description?: string;
  category?: string;
}

export interface Minia2aClient {
  /** The wallet address derived from the private key. */
  address: string;
  /**
   * Call a service. POST /x402/<service-id> with a JSON body; a 402 Payment
   * Required challenge is settled automatically in USDC on Base.
   * @param service - Service name ("gas") or full id ("x402-gas")
   * @param params - JSON body sent to the service
   * @param opts - Call options
   */
  call(service: string, params?: Record<string, any>, opts?: CallOptions): Promise<CallResult>;
  /**
   * Optional registration — unlocks 5 free trial calls for this wallet.
   * Signs "minia2a register: <wallet>" (EIP-191) locally.
   */
  register(name?: string): Promise<RegisterResult>;
  /** List the service catalog (free). */
  listServices(): Promise<{ ok: boolean; count?: number; services: Service[]; [key: string]: any }>;
  /** Platform stats (free). */
  status(): Promise<{ ok: boolean; [key: string]: any }>;
}

/**
 * Create a minia2a client backed by a wallet private key.
 * @param privateKey - Wallet private key (0x-prefixed or bare 64 hex chars).
 *   Falls back to process.env.MINIA2A_PRIVATE_KEY. The key is used only to
 *   sign locally; it is never sent to minia2a.
 */
export function createClient(privateKey?: string): Minia2aClient;
