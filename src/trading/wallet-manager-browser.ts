/// <reference lib="dom" />
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";

interface WalletBalance {
    token: string;
    amount: number;
    usdValue: number;
}

interface TradeConfig {
    symbol: string;
    amount: number;
    price: number;
    type: "buy" | "sell";
}

declare global {
    interface Window {
        solana?: any;
    }
}

export class WalletManagerBrowser {
    private static instance: WalletManagerBrowser;
    private connection: Connection;
    private wallet: any; // Phantom wallet instance
    private readonly endpoint = "https://api.mainnet-beta.solana.com";

    private constructor() {
        this.connection = new Connection(this.endpoint, "confirmed");
    }

    public static getInstance(): WalletManagerBrowser {
        if (!WalletManagerBrowser.instance) {
            WalletManagerBrowser.instance = new WalletManagerBrowser();
        }
        return WalletManagerBrowser.instance;
    }

    public async connectPhantom(): Promise<void> {
        try {
            // Check if running in browser
            if (typeof window === "undefined") {
                throw new Error(
                    "Phantom wallet requires a browser environment"
                );
            }

            // Check if Phantom is installed
            const provider = window.solana;
            if (!provider?.isPhantom) {
                throw new Error("Please install Phantom wallet!");
            }

            // Connect to Phantom
            const response = await provider.connect();
            this.wallet = provider;

            console.log(`\n🦊 Connected to Phantom Wallet`);
            console.log(`Address: ${response.publicKey.toString()}`);

            // Get initial balance
            const balance = await this.getSOLBalance();
            console.log(`SOL Balance: ${balance} SOL`);
        } catch (error) {
            console.error("Failed to connect to Phantom:", error);
            throw error;
        }
    }

    public async getSOLBalance(): Promise<number> {
        if (!this.wallet?.publicKey) throw new Error("Wallet not connected");

        const balance = await this.connection.getBalance(this.wallet.publicKey);
        return balance / LAMPORTS_PER_SOL;
    }

    public async getTokenBalance(tokenAddress: string): Promise<number> {
        if (!this.wallet?.publicKey) throw new Error("Wallet not connected");

        try {
            const tokenPublicKey = new PublicKey(tokenAddress);
            const tokenAccounts =
                await this.connection.getParsedTokenAccountsByOwner(
                    this.wallet.publicKey,
                    { mint: tokenPublicKey }
                );

            if (tokenAccounts.value.length === 0) return 0;

            const balance =
                tokenAccounts.value[0].account.data.parsed.info.tokenAmount
                    .uiAmount;
            return balance;
        } catch (error) {
            console.error(
                `Failed to get token balance for ${tokenAddress}:`,
                error
            );
            return 0;
        }
    }

    public async executeTrade(config: TradeConfig): Promise<string> {
        if (!this.wallet?.publicKey) throw new Error("Wallet not connected");

        try {
            // Create transaction
            const transaction = new Transaction();

            // Add trade instructions based on type
            if (config.type === "buy") {
                // Example: Swap SOL for token using Jupiter aggregator
                // This is a placeholder - actual implementation would integrate with Jupiter or another DEX
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: this.wallet.publicKey,
                        toPubkey: new PublicKey("MARKET_ADDRESS"), // Replace with actual market address
                        lamports: config.amount * LAMPORTS_PER_SOL,
                    })
                );
            } else {
                // Sell token
                // Similar to above, but in reverse
            }

            // Sign and send transaction
            const signature =
                await this.wallet.signAndSendTransaction(transaction);

            console.log(
                `\n📝 Trade executed: ${config.type.toUpperCase()} ${config.symbol}`
            );
            console.log(`Amount: ${config.amount}`);
            console.log(`Price: $${config.price}`);
            console.log(`Transaction: ${signature}`);

            return signature;
        } catch (error) {
            console.error("Failed to execute trade:", error);
            throw error;
        }
    }

    public async getAllBalances(): Promise<WalletBalance[]> {
        if (!this.wallet?.publicKey) throw new Error("Wallet not connected");

        const balances: WalletBalance[] = [];

        // Get SOL balance
        const solBalance = await this.getSOLBalance();
        balances.push({
            token: "SOL",
            amount: solBalance,
            usdValue: 0, // TODO: Get current price
        });

        // Get all token accounts
        const tokenAccounts =
            await this.connection.getParsedTokenAccountsByOwner(
                this.wallet.publicKey,
                {
                    programId: new PublicKey(
                        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
                    ),
                }
            );

        for (const { account } of tokenAccounts.value) {
            const parsedData = account.data.parsed.info;
            balances.push({
                token: parsedData.mint,
                amount: parsedData.tokenAmount.uiAmount,
                usdValue: 0, // TODO: Get current price
            });
        }

        return balances;
    }

    public getPublicKey(): string {
        if (!this.wallet?.publicKey) throw new Error("Wallet not connected");
        return this.wallet.publicKey.toString();
    }

    public isConnected(): boolean {
        return !!this.wallet?.publicKey;
    }

    public async disconnect(): Promise<void> {
        if (this.wallet) {
            await this.wallet.disconnect();
            this.wallet = null;
            console.log("\n👋 Disconnected from Phantom wallet");
        }
    }
}
