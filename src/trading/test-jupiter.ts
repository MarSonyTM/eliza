import { JupiterService } from "./jupiter-service";

async function testJupiter() {
    console.log("🪐 Testing Jupiter DEX Integration...");

    const jupiter = JupiterService.getInstance();

    try {
        // Initialize Jupiter
        await jupiter.initialize();

        // Test getting SOL/USDC quote
        console.log("\nTesting SOL/USDC quote...");
        const solMint = "So11111111111111111111111111111111111111112";
        const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        const quote = await jupiter.getQuote(
            solMint,
            usdcMint,
            1_000_000_000 // 1 SOL
        );

        console.log("Quote received:");
        console.log(`Input: 1 SOL`);
        console.log(
            `Output: ${parseFloat(quote.outputAmount) / 1_000_000} USDC`
        );
        console.log(`Price Impact: ${quote.priceImpact.toFixed(2)}%`);
        console.log(`Fee: ${parseFloat(quote.fee) / 1_000_000} USDC`);

        // Test getting SOL price
        console.log("\nTesting SOL price...");
        const solPrice = await jupiter.getTokenPrice(solMint);
        console.log(`Current SOL price: $${solPrice.toFixed(2)}`);

        console.log("\n✅ Jupiter integration test completed successfully");
    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    }
}

testJupiter().catch(console.error);
