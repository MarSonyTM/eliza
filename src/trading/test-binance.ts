import { BinanceService } from "./binance-service";

async function testBinanceService() {
    try {
        console.log("🔄 Starting Binance Service Test\n");

        // Initialize service
        console.log("Stage 1: Initializing Binance Service...");
        const binance = BinanceService.getInstance();

        // Test WebSocket connection
        console.log("\nStage 2: Testing WebSocket Connection...");
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        "Connection timeout - no connection after 5 seconds"
                    )
                );
            }, 5000);

            const checkConnection = setInterval(() => {
                if (binance.isConnected()) {
                    clearTimeout(timeout);
                    clearInterval(checkConnection);
                    resolve();
                }
            }, 100);
        });
        console.log("✅ WebSocket connected successfully");

        // Subscribe to BTC/USDT price updates
        console.log("\nStage 3: Subscribing to BTCUSDT price updates...");
        let priceUpdateReceived = false;
        const symbol = "BTCUSDT";

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        "Price update timeout - no updates received in 5 seconds"
                    )
                );
            }, 5000);

            binance.onPriceUpdate((update) => {
                if (update.symbol === symbol) {
                    if (!priceUpdateReceived) {
                        priceUpdateReceived = true;
                        console.log(
                            `✅ Received first price update: $${update.price.toFixed(2)}`
                        );
                        clearTimeout(timeout);
                        resolve();
                    }
                    console.log(`💹 BTC Price: $${update.price.toFixed(2)}`);
                }
            });

            binance.subscribeToSymbol(symbol);
        });

        // Get 24h volume
        console.log("\nStage 4: Fetching 24h trading volume...");
        const volume = await binance.get24hVolume(symbol);
        console.log(`✅ 24h Volume: ${volume.toFixed(2)} BTC`);

        // Monitor prices for 30 seconds
        console.log("\nStage 5: Monitoring prices for 30 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 30000));

        // Cleanup
        console.log("\n🧹 Cleaning up...");
        binance.unsubscribeFromSymbol(symbol);
        console.log("✅ Test completed successfully");
    } catch (error: any) {
        console.error("\n❌ TEST FAILED");
        console.error("Error:", error?.message || "Unknown error");
        if (error?.stack) console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}

// Run the test
testBinanceService();
