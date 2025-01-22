import { Connection, PublicKey } from "@solana/web3.js";
import { QuoteResponse } from "@jup-ag/api";
import { Jupiter, RouteInfo } from "@jup-ag/core";
import JSBI from "jsbi";

interface SwapQuote {
    inputAmount: string;
    outputAmount: string;
    executionPrice: number;
    priceImpact: number;
    fee: string;
}

interface SwapResult {
    txid: string;
    inputAddress: string;
    outputAddress: string;
    inputAmount: string;
    outputAmount: string;
}

interface PriceUpdate {
    tokenMint: string;
    price: number;
    timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

export class JupiterService {
    private static instance: JupiterService;
    private jupiter: Jupiter | null = null;
    private readonly connection: Connection;
    private readonly jupiterQuoteApi = "https://quote-api.jup.ag/v6";
    private priceUpdateCallbacks: PriceUpdateCallback[] = [];
    private pricePollingIntervals: Map<string, NodeJS.Timeout> = new Map();
    private priceCache: Map<string, { price: number; timestamp: number }> =
        new Map();
    private volumeCache: Map<string, { volume: number; timestamp: number }> =
        new Map();
    private readonly cacheDuration = 5000; // 5 seconds cache
    private lastRequestTime: number = 0;
    private readonly minRequestInterval = 1000; // 1 second between requests
    private readonly pollingInterval = 2000; // Poll every 2 seconds

    private constructor() {
        this.connection = new Connection(
            "https://api.mainnet-beta.solana.com",
            "confirmed"
        );
    }

    public static getInstance(): JupiterService {
        if (!JupiterService.instance) {
            JupiterService.instance = new JupiterService();
        }
        return JupiterService.instance;
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async rateLimitedFetch(
        url: string,
        retries = 3
    ): Promise<Response> {
        for (let i = 0; i < retries; i++) {
            try {
                // Ensure minimum time between requests
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    await this.sleep(
                        this.minRequestInterval - timeSinceLastRequest
                    );
                }

                this.lastRequestTime = Date.now();
                const response = await fetch(url);

                if (response.status === 429) {
                    const retryAfter = parseInt(
                        response.headers.get("retry-after") || "2"
                    );
                    const backoffTime = Math.max(retryAfter * 1000, 2000);
                    console.log(
                        `Rate limited, waiting ${backoffTime}ms before retry`
                    );
                    await this.sleep(backoffTime);
                    continue;
                }

                return response;
            } catch (error) {
                if (i === retries - 1) throw error;
                const backoffTime = Math.min(1000 * Math.pow(2, i), 10000);
                console.warn(`Request failed, retrying in ${backoffTime}ms...`);
                await this.sleep(backoffTime);
            }
        }
        throw new Error(`Failed after ${retries} retries`);
    }

    public async initialize(): Promise<void> {
        try {
            await this.initializeJupiter();
            console.log("🪐 Jupiter DEX service initialized");
        } catch (error) {
            console.error("Failed to initialize Jupiter:", error);
            throw error;
        }
    }

    private async initializeJupiter() {
        if (!this.jupiter) {
            this.jupiter = await Jupiter.load({
                connection: this.connection,
                cluster: "mainnet-beta",
                user: undefined, // Read-only mode
            });
        }
    }

    public async getQuote(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippage = 1 // 1% default slippage
    ): Promise<SwapQuote> {
        try {
            const response = await this.rateLimitedFetch(
                `${this.jupiterQuoteApi}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const quoteResponse = (await response.json()) as QuoteResponse;

            return {
                inputAmount: quoteResponse.inAmount,
                outputAmount: quoteResponse.outAmount,
                executionPrice: parseFloat(quoteResponse.priceImpactPct),
                priceImpact: parseFloat(quoteResponse.priceImpactPct),
                fee: quoteResponse.otherAmountThreshold,
            };
        } catch (error) {
            console.error("Failed to get swap quote:", error);
            throw error;
        }
    }

    public subscribeToPrice(tokenMint: string) {
        if (this.pricePollingIntervals.has(tokenMint)) {
            return; // Already subscribed
        }

        const interval = setInterval(async () => {
            try {
                const price = await this.getTokenPrice(tokenMint);
                const update: PriceUpdate = {
                    tokenMint,
                    price,
                    timestamp: Date.now(),
                };
                this.priceUpdateCallbacks.forEach((callback) =>
                    callback(update)
                );
            } catch (error) {
                console.warn(`Failed to update price for ${tokenMint}:`, error);
            }
        }, this.pollingInterval);

        this.pricePollingIntervals.set(tokenMint, interval);
    }

    public unsubscribeFromPrice(tokenMint: string) {
        const interval = this.pricePollingIntervals.get(tokenMint);
        if (interval) {
            clearInterval(interval);
            this.pricePollingIntervals.delete(tokenMint);
        }
    }

    public onPriceUpdate(callback: PriceUpdateCallback) {
        this.priceUpdateCallbacks.push(callback);
    }

    public removePriceUpdateCallback(callback: PriceUpdateCallback) {
        this.priceUpdateCallbacks = this.priceUpdateCallbacks.filter(
            (cb) => cb !== callback
        );
    }

    public isConnected(): boolean {
        return true; // Always return true since we're using polling
    }

    public async getTokenPrice(tokenMint: string): Promise<number> {
        // Check cache first
        const cached = this.priceCache.get(tokenMint);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.price;
        }

        try {
            const response = await this.rateLimitedFetch(
                `${this.jupiterQuoteApi}/price?ids=${tokenMint}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const price = data.data[tokenMint]?.price;

            if (price) {
                this.priceCache.set(tokenMint, {
                    price,
                    timestamp: Date.now(),
                });
                return price;
            }

            throw new Error("Price not available");
        } catch (error) {
            console.warn(
                "Failed to get price, using cached value if available"
            );
            if (cached) return cached.price;
            throw error;
        }
    }

    public async getTokenVolume(tokenMint: string): Promise<number> {
        try {
            // Check cache first
            const cached = this.volumeCache.get(tokenMint);
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                return cached.volume;
            }

            // Get current price
            const price = await this.getTokenPrice(tokenMint);

            // Estimate volume based on price and liquidity
            let estimatedVolume = price * 1000000; // Base volume

            // Adjust based on token
            if (tokenMint === "So11111111111111111111111111111111111111112") {
                // SOL
                estimatedVolume *= 1000; // SOL has very high volume
            } else if (
                tokenMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            ) {
                // USDC
                estimatedVolume *= 800;
            } else {
                estimatedVolume *= 10; // Other tokens assumed to have lower volume
            }

            // Cache the result
            this.volumeCache.set(tokenMint, {
                volume: estimatedVolume,
                timestamp: Date.now(),
            });

            return estimatedVolume;
        } catch (error) {
            console.warn("Failed to estimate token volume:", error);
            // Return last known volume if available
            const cached = this.volumeCache.get(tokenMint);
            if (cached) {
                return cached.volume;
            }
            return 0; // Safe fallback
        }
    }
}
