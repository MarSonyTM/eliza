import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";

interface JupiterPrice {
    inputMint: string;
    outputMint: string;
    amount: string;
    price: string;
}

interface JupiterQuote {
    route: any; // Simplified for now
    outAmount: number;
    priceImpactPct: number;
}

export class JupiterAPI {
    private static instance: JupiterAPI;
    private readonly baseURL = "https://quote-api.jup.ag/v4";
    private connection: Connection;

    private constructor() {
        this.connection = new Connection("https://api.mainnet-beta.solana.com");
    }

    public static getInstance(): JupiterAPI {
        if (!JupiterAPI.instance) {
            JupiterAPI.instance = new JupiterAPI();
        }
        return JupiterAPI.instance;
    }

    // Get price quote for a token pair
    public async getPriceQuote(
        inputMint: string,
        outputMint: string,
        amount: number
    ): Promise<JupiterQuote> {
        try {
            const response = await axios.get(`${this.baseURL}/quote`, {
                params: {
                    inputMint,
                    outputMint,
                    amount: amount.toString(),
                    slippageBps: 50, // 0.5% slippage
                },
            });

            return {
                route: response.data.data,
                outAmount: parseInt(response.data.data.outAmount),
                priceImpactPct: response.data.data.priceImpactPct,
            };
        } catch (error) {
            console.error("Error fetching Jupiter quote:", error);
            throw error;
        }
    }

    // Get token price in USDC
    public async getTokenPrice(tokenMint: string): Promise<number> {
        const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
        try {
            const response = await this.getPriceQuote(
                tokenMint,
                USDC_MINT,
                1_000_000 // 1 token in base units
            );
            return response.outAmount / 1_000_000; // Convert from USDC base units
        } catch (error) {
            console.error("Error fetching token price:", error);
            throw error;
        }
    }

    // Check liquidity for a token pair
    public async checkLiquidity(
        inputMint: string,
        outputMint: string
    ): Promise<boolean> {
        try {
            const quote = await this.getPriceQuote(
                inputMint,
                outputMint,
                1_000_000
            );
            return quote.priceImpactPct < 1; // Less than 1% price impact
        } catch {
            return false;
        }
    }
}
