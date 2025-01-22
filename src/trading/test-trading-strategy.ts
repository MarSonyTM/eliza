import { JupiterService } from "./jupiter-service";
import { MarketDataService } from "./market-data-service";
import { TradingStrategy } from "./trading-strategy";

async function validatePriceUpdates(
    jupiter: JupiterService,
    solMint: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        let updateReceived = false;
        const timeout = setTimeout(() => {
            if (!updateReceived) {
                reject(
                    new Error(
                        "Price update timeout - no updates received in 5 seconds"
                    )
                );
            }
        }, 5000);

        jupiter.onPriceUpdate((update) => {
            if (update.tokenMint === solMint) {
                updateReceived = true;
                clearTimeout(timeout);
                resolve();
            }
        });

        jupiter.subscribeToPrice(solMint);
    });
}

async function testTradingStrategy() {
    let jupiter: JupiterService | null = null;
    let marketData: MarketDataService | null = null;
    const solMint = "So11111111111111111111111111111111111111112";

    try {
        console.log("🔄 Starting Trading Strategy Test\n");

        // Stage 1: Initialize Jupiter Service
        console.log("Stage 1: Initializing Jupiter Service...");
        jupiter = JupiterService.getInstance();
        await jupiter.initialize();
        console.log("✅ Jupiter Service initialized");

        // Stage 2: Verify Price Updates
        console.log("\nStage 2: Verifying Price Updates...");
        await validatePriceUpdates(jupiter, solMint);
        console.log("✅ Price updates verified - receiving regular updates");

        // Stage 3: Initialize Market Data Service
        console.log("\nStage 3: Initializing Market Data Service...");
        marketData = MarketDataService.getInstance(true);
        await marketData.startTracking(solMint);
        if (!marketData)
            throw new Error("Failed to initialize Market Data Service");
        console.log("✅ Market Data Service initialized and tracking SOL");

        // Stage 4: Initialize Trading Strategy
        console.log("\nStage 4: Initializing Trading Strategy...");
        const strategy = TradingStrategy.getInstance();
        const initialSignal = await strategy.analyzeTradeOpportunity(solMint);
        console.log("✅ Trading Strategy initialized and analysis working");

        // Stage 5: Start Trading Simulation
        console.log(
            "\n🚀 All systems verified. Starting trading simulation..."
        );

        const duration = 5 * 60 * 1000; // 5 minutes
        const startTime = Date.now();
        let lastUpdate = Date.now();
        const updateInterval = 60000; // Status update every minute

        // Setup price monitoring
        jupiter.onPriceUpdate((update) => {
            if (update.tokenMint === solMint) {
                console.log(`💹 SOL Price: $${update.price.toFixed(3)}`);
            }
        });

        while (Date.now() - startTime < duration) {
            const signal = await strategy.analyzeTradeOpportunity(solMint);
            if (signal) {
                if (signal.type === "ENTRY") {
                    const success = await strategy.executeEntry(signal);
                    if (!success)
                        throw new Error("Failed to execute entry trade");
                } else if (signal.type === "EXIT") {
                    const success = await strategy.executeExit(signal);
                    if (!success)
                        throw new Error("Failed to execute exit trade");
                }
            }

            // Status updates
            if (Date.now() - lastUpdate >= updateInterval) {
                const stats = strategy.getStats();
                console.log(`\n📊 Performance Update:
                    Current Capital: $${stats.currentCapital.toFixed(2)}
                    Total Profit: $${stats.totalProfit.toFixed(2)}
                    Trades: ${stats.totalTrades}
                    Win Rate: ${stats.winningTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
                `);
                lastUpdate = Date.now();
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Final Report
        const finalStats = strategy.getStats();
        console.log(`\n📈 Final Performance Report:
            Initial Capital: $20.00
            Final Capital: $${finalStats.currentCapital.toFixed(2)}
            Total Profit: $${finalStats.totalProfit.toFixed(2)} (${((finalStats.totalProfit / 20) * 100).toFixed(1)}% return)
            Total Trades: ${finalStats.totalTrades}
            Winning Trades: ${finalStats.winningTrades}
            Win Rate: ${finalStats.winningTrades > 0 ? ((finalStats.winningTrades / finalStats.totalTrades) * 100).toFixed(1) : 0}%
            Max Drawdown: ${finalStats.maxDrawdown.toFixed(2)}%
        `);
    } catch (error: any) {
        console.error("\n❌ TEST FAILED");
        console.error("Error:", error?.message || "Unknown error");
        if (error?.stack) console.error("Stack trace:", error.stack);
        process.exit(1);
    } finally {
        // Cleanup
        console.log("\n🧹 Cleaning up...");
        if (jupiter) jupiter.unsubscribeFromPrice(solMint);
        if (marketData) await marketData.stopTracking(solMint);
    }
}

// Run the test
testTradingStrategy();
