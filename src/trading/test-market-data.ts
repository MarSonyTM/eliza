import { MarketDataService } from "./market-data-service";

async function testMarketData() {
    console.log("📊 Testing Market Data Service...");

    const marketData = MarketDataService.getInstance(true); // Enable test mode

    try {
        // Test 1: Initialize service
        console.log("\n1️⃣ Testing initialization...");
        await marketData.initialize();

        // Test 2: Start tracking valid token
        console.log("\n2️⃣ Testing token tracking...");
        const solMint = "So11111111111111111111111111111111111111112";
        await marketData.startTracking(solMint);

        // Test 3: Verify initial data
        console.log("\n3️⃣ Verifying initial data...");
        const initialPrice = marketData.getCurrentPrice(solMint);
        const initialVolume = marketData.getCurrentVolume(solMint);
        const initialHistory = marketData.getPriceHistory(solMint);
        const initialStats = marketData.getUpdateStats(solMint);

        console.log(`Initial price: $${initialPrice?.toFixed(2)}`);
        console.log(`Initial 24h volume: $${initialVolume?.toLocaleString()}`);
        console.log(`History length: ${initialHistory.length}`);
        console.log(`Update count: ${initialStats?.updateCount}`);
        console.log(`Error count: ${initialStats?.errors}`);

        if (
            !initialPrice ||
            !initialVolume ||
            initialHistory.length !== 1 ||
            initialStats?.updateCount !== 1
        ) {
            throw new Error("Initial data validation failed");
        }

        // Test 4: Try tracking same token again (should be idempotent)
        console.log("\n4️⃣ Testing duplicate tracking...");
        await marketData.startTracking(solMint);

        // Test 5: Wait for updates
        console.log("\n5️⃣ Waiting for price updates (30 seconds)...");
        await new Promise((resolve) => setTimeout(resolve, 30 * 1000));

        // Test 6: Verify updates occurred
        console.log("\n6️⃣ Verifying data updates...");
        const updatedStats = marketData.getUpdateStats(solMint);
        console.log(
            `Current price: $${marketData.getCurrentPrice(solMint)?.toFixed(2)}`
        );
        console.log(
            `Current 24h volume: $${marketData.getCurrentVolume(solMint)?.toLocaleString()}`
        );
        console.log(`Volume change: ${marketData.getVolumeChange(solMint)}%`);
        console.log(`Total updates: ${updatedStats?.updateCount}`);
        console.log(`Error count: ${updatedStats?.errors}`);
        console.log(
            `Price history points: ${marketData.getPriceHistory(solMint).length}`
        );
        console.log(`24h price change: ${marketData.get24hChange(solMint)}%`);

        if (!updatedStats || updatedStats.updateCount < 3) {
            throw new Error("Not enough data updates received");
        }

        // Test 7: Verify volume data
        console.log("\n7️⃣ Verifying volume data...");
        const volumeHistory = marketData.getPriceHistory(solMint);
        const hasVolume = volumeHistory.every(
            (point) => typeof point.volume24h === "number"
        );
        if (!hasVolume) {
            throw new Error("Volume data missing from history");
        }
        console.log("Volume history validation passed");

        // Test 8: Stop tracking
        console.log("\n8️⃣ Testing stop tracking...");
        marketData.stopTracking(solMint);

        if (
            marketData.getCurrentPrice(solMint) !== null ||
            marketData.getCurrentVolume(solMint) !== null
        ) {
            throw new Error("Token still being tracked after stop");
        }

        console.log("\n✅ All tests completed successfully!");
    } catch (error) {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    }
}

testMarketData().catch(console.error);
