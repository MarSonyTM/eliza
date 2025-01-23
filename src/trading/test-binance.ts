import { BinanceService } from "./binance-service";

async function testBinanceService() {
    try {
        console.log("🔄 Starting Binance Service Test\n");

        // Initialize service
        console.log("Stage 1: Initializing Service...");
        const binance = BinanceService.getInstance();
        console.log("✅ Service initialized\n");

        // Test WebSocket Connection
        console.log("Stage 2: Testing WebSocket Connection...");
        let priceUpdates = 0;
        const symbol = "BTCUSDT";

        const priceCallback = (price: number) => {
            console.log(`💹 BTC Price: $${price.toFixed(2)}`);
            priceUpdates++;
        };

        binance.subscribeToPrice(symbol, priceCallback);

        // Wait for price updates
        console.log("Waiting for price updates (10 seconds)...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
        console.log(`✅ Received ${priceUpdates} price updates\n`);

        // Test Price Retrieval
        console.log("Stage 3: Testing Price Retrieval...");
        const price = await binance.getPrice(symbol);
        console.log(`Current BTC Price: $${price.toFixed(2)}`);
        console.log("✅ Price retrieved successfully\n");

        // Cleanup
        console.log("Stage 4: Cleanup...");
        binance.unsubscribeFromPrice(symbol, priceCallback);
        console.log("✅ Cleanup completed\n");

        console.log("✅ All Binance service tests completed successfully!");
    } catch (error: any) {
        console.error("\n❌ TEST FAILED");
        console.error("Error:", error?.message || "Unknown error");
        if (error?.stack) console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}

// Run the test
testBinanceService();
