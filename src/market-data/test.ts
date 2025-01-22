import { MarketDataService } from "./market-data-service";
import { VisualizationService } from "./visualization-service";

async function testMarketData() {
    const service = MarketDataService.getInstance();
    const visualizer = VisualizationService.getInstance();
    let updateCount = 0;

    // Test 1: Get Bitcoin price from multiple sources
    console.log("Testing Bitcoin price aggregation...");
    try {
        const btcPrices = await service.getAggregatedPrice(
            "BTCUSDT",
            "bitcoin"
        );
        console.log("Bitcoin prices:", btcPrices);

        // Set price alerts with 10 cents range
        const currentPrice = btcPrices[0].price;
        const upperPrice = currentPrice + 0.1; // Alert if price goes up by 10 cents
        const lowerPrice = currentPrice - 0.1; // Alert if price goes down by 10 cents

        console.log(`\nSetting price alerts for BTC:`);
        console.log(`Current price: $${currentPrice.toFixed(2)}`);
        console.log(`Upper alert: $${upperPrice.toFixed(2)} (+$0.10)`);
        console.log(`Lower alert: $${lowerPrice.toFixed(2)} (-$0.10)`);

        // Create alerts
        service.createPriceAlert("BTCUSDT", "above", upperPrice, (price) => {
            console.log(
                `\n🔔 ALERT: BTC price went above $${upperPrice.toFixed(2)}!`
            );
            console.log(`Current price: $${price.toFixed(2)}`);
            console.log(`Movement: +$${(price - currentPrice).toFixed(2)}`);

            // Create new alert above current price
            const newUpperPrice = price + 0.1;
            service.createPriceAlert("BTCUSDT", "above", newUpperPrice, (p) => {
                console.log(
                    `\n🔔 ALERT: BTC price went above $${newUpperPrice.toFixed(2)}! Current price: $${p.toFixed(2)}`
                );
            });
            console.log(`New upper alert set at $${newUpperPrice.toFixed(2)}`);
        });

        service.createPriceAlert("BTCUSDT", "below", lowerPrice, (price) => {
            console.log(
                `\n🔔 ALERT: BTC price went below $${lowerPrice.toFixed(2)}!`
            );
            console.log(`Current price: $${price.toFixed(2)}`);
            console.log(`Movement: -$${(currentPrice - price).toFixed(2)}`);

            // Create new alert below current price
            const newLowerPrice = price - 0.1;
            service.createPriceAlert("BTCUSDT", "below", newLowerPrice, (p) => {
                console.log(
                    `\n🔔 ALERT: BTC price went below $${newLowerPrice.toFixed(2)}! Current price: $${p.toFixed(2)}`
                );
            });
            console.log(`New lower alert set at $${newLowerPrice.toFixed(2)}`);
        });

        console.log("\nActive alerts:", service.getActiveAlerts());
    } catch (error) {
        console.error("Failed to get Bitcoin prices:", error);
    }

    // Test 2: Subscribe to real-time Bitcoin price updates with visualization
    console.log("\nStarting real-time price tracking with visualization...");
    service.subscribeToPriceUpdates("BTCUSDT", (data) => {
        updateCount++;
        visualizer.addPricePoint("BTCUSDT", data.price, data.timestamp);

        // Basic price update
        console.log(
            `Real-time BTC: $${data.price.toFixed(2)} (${data.source})`
        );

        // Every 10 updates, show the chart and stats
        if (updateCount % 10 === 0) {
            console.clear(); // Clear console for better visualization
            visualizer.displayPriceChart("BTCUSDT");
            visualizer.displayStats("BTCUSDT");
            console.log("\nActive alerts:", service.getActiveAlerts());
        }
    });

    // Test 3: Get comprehensive market data for Ethereum
    console.log("\nTesting comprehensive market data for Ethereum...");
    try {
        const ethData = await service.getMarketData(
            "ETHUSDT",
            "ethereum",
            "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs" // ETH SPL token address
        );
        console.log("Ethereum market data:", ethData);
    } catch (error) {
        console.error("Failed to get Ethereum market data:", error);
    }

    // Keep the script running for WebSocket updates
    console.log(
        "\nListening for real-time updates and price alerts (press Ctrl+C to stop)..."
    );
}

testMarketData().catch(console.error);
