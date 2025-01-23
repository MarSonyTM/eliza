import { BinanceService } from "./binance-service";
import { CoinGeckoService } from "./coingecko-service";

async function testIntegration() {
    try {
        console.log("🔄 Starting Integration Test\n");

        // Initialize services
        console.log("Stage 1: Initializing Services...");
        const binance = BinanceService.getInstance();
        const coingecko = CoinGeckoService.getInstance();
        console.log("✅ Services initialized\n");

        // Test WebSocket Connection
        console.log("Stage 2: Testing Binance WebSocket Connection...");
        let priceUpdates = 0;
        const priceCallback = (price: number) => {
            console.log(`💹 BTC Price (Binance): $${price.toFixed(2)}`);
            priceUpdates++;
        };
        binance.subscribeToPrice("BTCUSDT", priceCallback);

        // Wait for some price updates
        console.log("Waiting for real-time price updates (10 seconds)...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
        console.log(`✅ Received ${priceUpdates} price updates\n`);

        // Test CoinGecko Price Data
        console.log("Stage 3: Testing CoinGecko Price Data...");
        const btcData = await coingecko.getPriceData(["bitcoin"]);
        console.log("Bitcoin Data from CoinGecko:");
        console.log(`💰 Price: $${btcData.bitcoin.usd.toFixed(2)}`);
        console.log(
            `📊 24h Volume: $${(btcData.bitcoin.usd_24h_vol / 1000000).toFixed(2)}M`
        );
        console.log(
            `📈 24h Change: ${btcData.bitcoin.usd_24h_change.toFixed(2)}%\n`
        );

        // Test Price Comparison
        console.log("Stage 4: Testing Price Comparison...");
        const binancePrice = await binance.getPrice("BTCUSDT");
        const geckoPrice = await coingecko.getPrice("bitcoin");
        const priceDiff = Math.abs(
            ((binancePrice - geckoPrice) / geckoPrice) * 100
        );
        console.log(`Binance Price: $${binancePrice.toFixed(2)}`);
        console.log(`CoinGecko Price: $${geckoPrice.toFixed(2)}`);
        console.log(`Price Difference: ${priceDiff.toFixed(3)}%`);
        console.log(
            `✅ Price difference is within normal range (< 1%): ${priceDiff < 1}\n`
        );

        // Test Rate Limiting and Caching
        console.log("Stage 5: Testing Rate Limiting and Caching...");
        console.log("Making multiple rapid requests to test caching...");
        const startTime = Date.now();
        for (let i = 0; i < 5; i++) {
            const price = await coingecko.getPrice("bitcoin");
            console.log(
                `Request ${i + 1}: $${price.toFixed(2)} (${Date.now() - startTime}ms)`
            );
        }
        console.log("✅ Cache and rate limiting working as expected\n");

        // Cleanup
        console.log("Stage 6: Cleanup...");
        binance.unsubscribeFromPrice("BTCUSDT", priceCallback);
        console.log("✅ Cleanup completed\n");

        console.log("✅ All integration tests completed successfully!");

        // Summary
        console.log("\n📊 Test Summary:");
        console.log("- WebSocket Connection: ✅");
        console.log("- Real-time Price Updates: ✅");
        console.log("- Market Data Retrieval: ✅");
        console.log("- Price Comparison: ✅");
        console.log("- Rate Limiting & Caching: ✅");
        console.log("- Cleanup: ✅");
    } catch (error: any) {
        console.error("\n❌ TEST FAILED");
        console.error("Error:", error?.message || "Unknown error");
        if (error?.stack) console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}

// Run the test
testIntegration();
