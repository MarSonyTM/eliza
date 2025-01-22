import { MarketDataService } from "../market-data/market-data-service";
import { VisualizationService } from "../market-data/visualization-service";
import { MLStrategy } from "./ml-strategy";

interface TradePosition {
    symbol: string;
    entryPrice: number;
    quantity: number;
    timestamp: number;
    type: "long" | "short";
}

interface TradingMetrics {
    totalTrades: number;
    successfulTrades: number;
    totalProfit: number;
    winRate: number;
    averageProfit: number;
}

export class TradingAgent {
    private static instance: TradingAgent;
    private marketData: MarketDataService;
    private visualizer: VisualizationService;
    private activePositions: Map<string, TradePosition> = new Map();
    private tradingHistory: TradePosition[] = [];
    private metrics: TradingMetrics = {
        totalTrades: 0,
        successfulTrades: 0,
        totalProfit: 0,
        winRate: 0,
        averageProfit: 0,
    };
    private mlStrategy: MLStrategy;

    // Trading parameters
    private readonly profitTarget = 0.005; // 0.5% profit target
    private readonly stopLoss = 0.003; // 0.3% stop loss
    private readonly positionSize = 100; // $100 per trade
    private readonly maxPositions = 3; // Maximum concurrent positions

    private constructor() {
        this.marketData = MarketDataService.getInstance();
        this.visualizer = VisualizationService.getInstance();
        this.mlStrategy = MLStrategy.getInstance();
        this.initializeAgent();
    }

    public static getInstance(): TradingAgent {
        if (!TradingAgent.instance) {
            TradingAgent.instance = new TradingAgent();
        }
        return TradingAgent.instance;
    }

    private initializeAgent(): void {
        console.log("🤖 Initializing Trading Agent...");
        console.log(`Initial Parameters:`);
        console.log(`- Profit Target: ${this.profitTarget * 100}%`);
        console.log(`- Stop Loss: ${this.stopLoss * 100}%`);
        console.log(`- Position Size: $${this.positionSize}`);
        console.log(`- Max Positions: ${this.maxPositions}`);
    }

    public startTrading(symbol: string): void {
        console.log(`\n🚀 Starting automated trading for ${symbol}`);

        this.marketData.subscribeToPriceUpdates(symbol, (data) => {
            this.processPrice(symbol, data.price);
            this.checkPositions(symbol, data.price);
            this.visualizer.addPricePoint(symbol, data.price, data.timestamp);

            // Display trading metrics periodically
            if (
                this.metrics.totalTrades > 0 &&
                this.metrics.totalTrades % 5 === 0
            ) {
                this.displayMetrics();
                this.visualizer.displayPriceChart(symbol);
            }
        });
    }

    private processPrice(symbol: string, price: number): void {
        const history = this.visualizer.getPriceHistory(symbol);
        if (history.length < 10) return;

        // Get ML prediction
        const prediction = this.mlStrategy.getPrediction(symbol);

        // Add data point for learning
        this.mlStrategy.addDataPoint(
            symbol,
            price,
            1000000, // TODO: Get real volume
            (price - history[0]) / history[0]
        );

        if (prediction && prediction.confidence > 0.7) {
            const predictedChange = (prediction.predictedPrice - price) / price;

            // Strong upward prediction -> go long
            if (
                predictedChange > this.profitTarget &&
                !this.activePositions.has(symbol)
            ) {
                this.openPosition(symbol, price, "long");
                console.log(
                    `\n🤖 ML Prediction: Price will rise to $${prediction.predictedPrice.toFixed(2)}`
                );
                console.log(
                    `Confidence: ${(prediction.confidence * 100).toFixed(1)}%`
                );
            }
            // Strong downward prediction -> go short
            else if (
                predictedChange < -this.profitTarget &&
                !this.activePositions.has(symbol)
            ) {
                this.openPosition(symbol, price, "short");
                console.log(
                    `\n🤖 ML Prediction: Price will fall to $${prediction.predictedPrice.toFixed(2)}`
                );
                console.log(
                    `Confidence: ${(prediction.confidence * 100).toFixed(1)}%`
                );
            }
        }
    }

    private checkPositions(symbol: string, currentPrice: number): void {
        const position = this.activePositions.get(symbol);
        if (!position) return;

        const pnl = this.calculatePnL(position, currentPrice);

        // Check if we hit profit target or stop loss
        if (pnl >= this.profitTarget || pnl <= -this.stopLoss) {
            this.closePosition(symbol, currentPrice);
        }
    }

    private openPosition(
        symbol: string,
        price: number,
        type: "long" | "short"
    ): void {
        if (this.activePositions.size >= this.maxPositions) return;

        const position: TradePosition = {
            symbol,
            entryPrice: price,
            quantity: this.positionSize / price,
            timestamp: Date.now(),
            type,
        };

        this.activePositions.set(symbol, position);
        console.log(
            `\n📈 Opening ${type} position for ${symbol} at $${price.toFixed(2)}`
        );
    }

    private closePosition(symbol: string, currentPrice: number): void {
        const position = this.activePositions.get(symbol);
        if (!position) return;

        const pnl = this.calculatePnL(position, currentPrice);
        const profit = pnl * this.positionSize;

        // Update metrics
        this.metrics.totalTrades++;
        if (profit > 0) this.metrics.successfulTrades++;
        this.metrics.totalProfit += profit;
        this.metrics.winRate =
            (this.metrics.successfulTrades / this.metrics.totalTrades) * 100;
        this.metrics.averageProfit =
            this.metrics.totalProfit / this.metrics.totalTrades;

        // Update ML model with trade result
        this.mlStrategy.updateModelFromTradeResult(symbol, profit > 0, profit);

        console.log(
            `\n📉 Closing position for ${symbol} at $${currentPrice.toFixed(2)}`
        );
        console.log(
            `Profit/Loss: $${profit.toFixed(2)} (${(pnl * 100).toFixed(2)}%)`
        );

        this.tradingHistory.push(position);
        this.activePositions.delete(symbol);
    }

    private calculatePnL(
        position: TradePosition,
        currentPrice: number
    ): number {
        if (position.type === "long") {
            return (currentPrice - position.entryPrice) / position.entryPrice;
        } else {
            return (position.entryPrice - currentPrice) / position.entryPrice;
        }
    }

    private calculateAverage(prices: number[]): number {
        return prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    private displayMetrics(): void {
        console.log("\n📊 Trading Metrics:");
        console.log(`Total Trades: ${this.metrics.totalTrades}`);
        console.log(`Win Rate: ${this.metrics.winRate.toFixed(2)}%`);
        console.log(`Total Profit: $${this.metrics.totalProfit.toFixed(2)}`);
        console.log(
            `Average Profit per Trade: $${this.metrics.averageProfit.toFixed(2)}`
        );
        console.log(`Active Positions: ${this.activePositions.size}`);
    }
}
