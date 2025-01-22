import { MarketDataService } from "./market-data-service";
import { TrendAnalyzer, TrendDirection } from "./trend-analyzer";

async function testTrendAnalyzer() {
    console.log("📈 Testing Trend Analyzer...");

    const marketData = MarketDataService.getInstance(true); // Enable test mode
    const analyzer = TrendAnalyzer.getInstance();

    try {
        // Test 1: Initialize services
        console.log("\n1️⃣ Testing initialization...");
        await marketData.initialize();

        // Test 2: Start tracking SOL
        console.log("\n2️⃣ Starting price tracking...");
        const solMint = "So11111111111111111111111111111111111111112";
        await marketData.startTracking(solMint);

        // Test 3: Initial trend analysis
        console.log("\n3️⃣ Initial trend analysis...");
        let trend = analyzer.analyzeTrend(solMint);
        console.log(
            "Initial trend analysis:",
            trend
                ? {
                      direction: trend.direction,
                      strength: `${trend.strength.toFixed(2)}%`,
                      priceChange: `${trend.priceChange}%`,
                      volumeChange: `${trend.volumeChange}%`,
                      confidence: `${trend.confidence}%`,
                  }
                : "Insufficient data"
        );

        // Test 4: Wait for more data points
        console.log("\n4️⃣ Waiting for more data points (30 seconds)...");
        await new Promise((resolve) => setTimeout(resolve, 30 * 1000));

        // Test 5: Analyze trend with more data
        console.log("\n5️⃣ Analyzing trend with more data...");
        trend = analyzer.analyzeTrend(solMint);

        if (!trend) {
            throw new Error("Failed to get trend analysis");
        }

        console.log("Updated trend analysis:");
        console.log(`Direction: ${trend.direction}`);
        console.log(`Strength: ${trend.strength.toFixed(2)}%`);
        console.log(`Price Change: ${trend.priceChange}%`);
        console.log(`Volume Change: ${trend.volumeChange}%`);
        console.log(`SMA20: $${trend.sma20}`);
        console.log(`SMA50: $${trend.sma50}`);
        console.log(`Reversal Detected: ${trend.isReversal}`);
        console.log(`Confidence: ${trend.confidence}%`);

        // Test 6: Verify trend analysis components
        console.log("\n6️⃣ Verifying trend analysis...");
        const isValid =
            trend.direction in TrendDirection &&
            trend.strength >= 0 &&
            trend.strength <= 100 &&
            typeof trend.priceChange === "number" &&
            typeof trend.volumeChange === "number" &&
            trend.sma20 > 0 &&
            trend.sma50 > 0 &&
            typeof trend.isReversal === "boolean" &&
            trend.confidence >= 0 &&
            trend.confidence <= 100;

        if (!isValid) {
            throw new Error("Invalid trend analysis data");
        }

        // Test 7: Clean up
        console.log("\n7️⃣ Cleaning up...");
        marketData.stopTracking(solMint);

        console.log("\n✅ All trend analyzer tests completed successfully!");
    } catch (error) {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    }
}

testTrendAnalyzer().catch(console.error);
