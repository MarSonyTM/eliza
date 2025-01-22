import { WalletManagerBrowser } from "./wallet-manager-browser";
import { WalletManagerNode } from "./wallet-manager-node";

async function testWallet() {
    console.log("Testing wallet functionality...");

    // Use Node.js wallet for testing
    const wallet = WalletManagerNode.getInstance();

    try {
        await wallet.initializeTest();

        // Get balances
        const balances = await wallet.getAllBalances();
        console.log("\nCurrent balances:");
        balances.forEach(
            (balance: { token: string; amount: number; usdValue: number }) => {
                console.log(
                    `${balance.token}: ${balance.amount} (${balance.usdValue} USD)`
                );
            }
        );

        console.log("\n✅ Wallet test completed successfully");
    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    }
}

testWallet().catch(console.error);
