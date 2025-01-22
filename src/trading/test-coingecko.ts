import { CoinGeckoService } from "./coingecko-service";

async function testCoinGeckoService() {
    try {
        console.log("🔄 Starting CoinGecko Service Test\n");

        // Initialize service
        console.log("Stage 1: Initializing CoinGecko Service...");
        const coingecko = CoinGeckoService.getInstance();
        console.log("✅ CoinGecko Service initialized");

        // Test single price fetch
        console.log("\nStage 2: Fetching Bitcoin price...");
        const btcPrice = await coingecko.getPrice("bitcoin");
        console.log(`✅ BTC Price: $${btcPrice.toFixed(2)}`);

        // Test batch price fetch
        console.log("\nStage 3: Fetching multiple coin prices...");
        const coins = ["bitcoin", "ethereum", "solana"];
        const priceData = await coingecko.getPriceData(coins);
        console.log("✅ Price data received:");
        for (const [coin, data] of Object.entries(priceData)) {
            console.log(
                `${coin.toUpperCase()}: $${data.usd.toFixed(2)} | 24h Volume: $${(data.usd_24h_vol / 1000000).toFixed(2)}M | 24h Change: ${data.usd_24h_change.toFixed(2)}%`
            );
        }

        // Test 24h volume
        console.log("\nStage 4: Fetching 24h trading volume...");
        const btcVolume = await coingecko.get24hVolume("bitcoin");
        console.log(`✅ BTC 24h Volume: $${(btcVolume / 1000000).toFixed(2)}M`);

        // Test 24h price change
        console.log("\nStage 5: Fetching 24h price change...");
        const btcChange = await coingecko.get24hChange("bitcoin");
        console.log(`✅ BTC 24h Change: ${btcChange.toFixed(2)}%`);

        // Test price validation
        console.log("\nStage 6: Testing price validation...");
        const testPrice = btcPrice * 1.005; // Test with 0.5% difference
        const isValid = await coingecko.validatePrice("bitcoin", testPrice, 1);
        console.log(
            `✅ Price validation test ${isValid ? "passed" : "failed"} (0.5% difference)`
        );

        console.log("\n✅ All tests completed successfully");
    } catch (error: any) {
        console.error("\n❌ TEST FAILED");
        console.error("Error:", error?.message || "Unknown error");
        if (error?.stack) console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}

// Run the test
testCoinGeckoService();
