import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    Keypair,
} from "@solana/web3.js";

interface WalletBalance {
    token: string;
    amount: number;
    usdValue: number;
}

export class WalletManagerNode {
    private static instance: WalletManagerNode;
    private connection: Connection;
    private keypair: Keypair | null = null;
    private readonly endpoint = "https://api.mainnet-beta.solana.com";

    private constructor() {
        this.connection = new Connection(this.endpoint, "confirmed");
    }

    public static getInstance(): WalletManagerNode {
        if (!WalletManagerNode.instance) {
            WalletManagerNode.instance = new WalletManagerNode();
        }
        return WalletManagerNode.instance;
    }

    public async initializeTest(): Promise<void> {
        // Generate a test keypair
        this.keypair = Keypair.generate();
        console.log(`\n🔑 Test wallet initialized`);
        console.log(`Address: ${this.keypair.publicKey.toString()}`);
    }

    public getPublicKey(): PublicKey {
        if (!this.keypair) throw new Error("Wallet not initialized");
        return this.keypair.publicKey;
    }

    public async getSOLBalance(): Promise<number> {
        if (!this.keypair) throw new Error("Wallet not initialized");
        const balance = await this.connection.getBalance(
            this.keypair.publicKey
        );
        return balance / LAMPORTS_PER_SOL;
    }

    public async getTokenBalance(tokenAddress: string): Promise<number> {
        if (!this.keypair) throw new Error("Wallet not initialized");

        try {
            const tokenPublicKey = new PublicKey(tokenAddress);
            const tokenAccounts =
                await this.connection.getParsedTokenAccountsByOwner(
                    this.keypair.publicKey,
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

    public async getAllBalances(): Promise<WalletBalance[]> {
        if (!this.keypair) throw new Error("Wallet not initialized");

        const balances: WalletBalance[] = [];

        // Get SOL balance
        const solBalance = await this.getSOLBalance();
        balances.push({
            token: "SOL",
            amount: solBalance,
            usdValue: 0,
        });

        // Get all token accounts
        const tokenAccounts =
            await this.connection.getParsedTokenAccountsByOwner(
                this.keypair.publicKey,
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
                usdValue: 0,
            });
        }

        return balances;
    }
}
