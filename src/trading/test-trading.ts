import { TradingAgent } from "./trading-agent";

async function testTradingAgent() {
    console.log("🤖 Starting Trading Agent Test...");

    const agent = TradingAgent.getInstance();

    // Start trading Bitcoin
    agent.startTrading("BTCUSDT");

    console.log("\n📈 Trading agent is now running...");
    console.log("- Monitoring BTC price movements");
    console.log("- Will open positions based on momentum strategy");
    console.log("- Taking profits at 0.5% gain");
    console.log("- Cutting losses at 0.3% loss");
    console.log("- Using $100 position size");
    console.log("\nPress Ctrl+C to stop the agent");
}

testTradingAgent().catch(console.error);
