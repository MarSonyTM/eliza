import { JupiterService } from "./jupiter-service";
import { TrendAnalyzer, TrendDirection, TrendAnalysis } from "./trend-analyzer";

interface Position {
    tokenMint: string;
    entryPrice: number;
    amount: number;
    stopLoss: number;
    takeProfit: number;
    timestamp: number;
    initialCapital: number;
}

interface TradeSignal {
    type: "ENTRY" | "EXIT";
    tokenMint: string;
    price: number;
    confidence: number;
    reason: string;
}

interface TradeStats {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    currentCapital: number;
    maxDrawdown: number;
}

export class TradingStrategy {
    private static instance: TradingStrategy;
    private readonly jupiter: JupiterService;
    private readonly analyzer: TrendAnalyzer;
    private readonly positions: Map<string, Position>;
    private initialCapital: number = 20; // Starting with $20
    private currentCapital: number = 20;
    private readonly stats: TradeStats = {
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
        currentCapital: 20,
        maxDrawdown: 0,
    };

    // Strategy parameters optimized for more active trading
    private readonly minConfidence = 50; // Lowered from 60
    private readonly minTrendStrength = 3; // Lowered from 5
    private readonly stopLossPercent = 1; // Increased from 0.5
    private readonly takeProfitPercent = 2; // Increased from 1
    private readonly maxPositions = 3; // Increased from 2
    private readonly positionSize = 0.3; // Lowered from 0.4 to allow more trades
    private readonly minVolume = 50000; // Lowered from 100000
    private readonly consecutiveLossLimit = 5; // Increased from 4
    private consecutiveLosses = 0;

    private constructor() {
        this.jupiter = JupiterService.getInstance();
        this.analyzer = TrendAnalyzer.getInstance();
        this.positions = new Map();
    }

    public static getInstance(): TradingStrategy {
        if (!TradingStrategy.instance) {
            TradingStrategy.instance = new TradingStrategy();
        }
        return TradingStrategy.instance;
    }

    public async analyzeTradeOpportunity(
        tokenMint: string
    ): Promise<TradeSignal | null> {
        try {
            const trend = this.analyzer.analyzeTrend(tokenMint);
            if (!trend) return null;

            const position = this.positions.get(tokenMint);
            if (position) {
                return this.checkExitConditions(position, trend);
            }

            // If we've hit our consecutive loss limit, skip new entries
            if (this.consecutiveLosses >= this.consecutiveLossLimit) {
                console.log(
                    "⚠️ Consecutive loss limit reached. Taking a break from new trades."
                );
                return null;
            }

            return this.checkEntryConditions(tokenMint, trend);
        } catch (error) {
            console.error("Failed to analyze trade opportunity:", error);
            return null;
        }
    }

    private async checkEntryConditions(
        tokenMint: string,
        trend: TrendAnalysis
    ): Promise<TradeSignal | null> {
        try {
            if (this.positions.size >= this.maxPositions) {
                return null;
            }

            // Additional safety checks
            if (this.currentCapital < 5) {
                // Minimum $5 required
                console.log("⚠️ Insufficient capital for new trades");
                return null;
            }

            // Get volume with retry
            let volume24h = 0;
            for (let i = 0; i < 3; i++) {
                try {
                    volume24h = await this.jupiter.getTokenVolume(tokenMint);
                    if (volume24h > 0) break;
                } catch (e) {
                    if (i === 2)
                        console.warn(
                            `Failed to get volume after 3 attempts for ${tokenMint}`
                        );
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

            if (volume24h < this.minVolume) {
                return null;
            }

            // Strong trend confirmation with higher confidence
            if (
                trend.confidence < this.minConfidence ||
                trend.strength < this.minTrendStrength
            ) {
                return null;
            }

            if (trend.isReversal) {
                return null;
            }

            // Only enter on strong bullish trends
            if (trend.direction === TrendDirection.BULLISH) {
                // Get price with retry
                let currentPrice = 0;
                for (let i = 0; i < 3; i++) {
                    try {
                        currentPrice =
                            await this.jupiter.getTokenPrice(tokenMint);
                        if (currentPrice > 0) break;
                    } catch (e) {
                        if (i === 2)
                            console.warn(
                                `Failed to get price after 3 attempts for ${tokenMint}`
                            );
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000)
                        );
                    }
                }

                if (currentPrice === 0) {
                    console.warn("Could not get valid price for", tokenMint);
                    return null;
                }

                // Additional volatility check
                const priceHistory = trend.sma20 - trend.sma50;
                if (Math.abs(priceHistory) > currentPrice * 0.02) {
                    // Max 2% volatility
                    return null;
                }

                return {
                    type: "ENTRY",
                    tokenMint,
                    price: currentPrice,
                    confidence: trend.confidence,
                    reason: `Bullish trend with ${trend.strength.toFixed(1)}% strength, ${trend.confidence.toFixed(1)}% confidence`,
                };
            }

            return null;
        } catch (error) {
            console.warn("Error in checkEntryConditions:", error);
            return null;
        }
    }

    private async checkExitConditions(
        position: Position,
        trend: TrendAnalysis
    ): Promise<TradeSignal | null> {
        try {
            // Get price with retry
            let currentPrice = 0;
            for (let i = 0; i < 3; i++) {
                try {
                    currentPrice = await this.jupiter.getTokenPrice(
                        position.tokenMint
                    );
                    if (currentPrice > 0) break;
                } catch (e) {
                    if (i === 2)
                        console.warn(
                            `Failed to get price after 3 attempts for ${position.tokenMint}`
                        );
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

            if (currentPrice === 0) {
                console.warn(
                    "Could not get valid price for",
                    position.tokenMint
                );
                return null;
            }

            const priceChange =
                ((currentPrice - position.entryPrice) / position.entryPrice) *
                100;

            // Dynamic take profit based on trend strength
            const dynamicTakeProfit = Math.min(
                this.takeProfitPercent * (1 + trend.strength / 100),
                this.takeProfitPercent * 2
            );

            // Stop loss hit
            if (priceChange <= -this.stopLossPercent) {
                return {
                    type: "EXIT",
                    tokenMint: position.tokenMint,
                    price: currentPrice,
                    confidence: 100,
                    reason: `Stop loss triggered at ${priceChange.toFixed(2)}%`,
                };
            }

            // Take profit hit
            if (priceChange >= dynamicTakeProfit) {
                return {
                    type: "EXIT",
                    tokenMint: position.tokenMint,
                    price: currentPrice,
                    confidence: 100,
                    reason: `Take profit triggered at ${priceChange.toFixed(2)}%`,
                };
            }

            // Early exit on trend reversal
            if (
                trend.isReversal ||
                trend.direction === TrendDirection.BEARISH
            ) {
                if (priceChange > 0) {
                    // Only exit if we're in profit
                    return {
                        type: "EXIT",
                        tokenMint: position.tokenMint,
                        price: currentPrice,
                        confidence: trend.confidence,
                        reason: `Trend reversal while in profit (${priceChange.toFixed(2)}%)`,
                    };
                }
            }

            return null;
        } catch (error) {
            console.warn("Error in checkExitConditions:", error);
            return null;
        }
    }

    public async executeEntry(signal: TradeSignal): Promise<boolean> {
        try {
            // Calculate position size with risk management
            const positionAmount =
                this.currentCapital *
                this.positionSize *
                (1 - Math.min(this.consecutiveLosses * 0.1, 0.5)); // Reduce size after losses

            // Create position
            const position: Position = {
                tokenMint: signal.tokenMint,
                entryPrice: signal.price,
                amount: positionAmount / signal.price,
                stopLoss: signal.price * (1 - this.stopLossPercent / 100),
                takeProfit: signal.price * (1 + this.takeProfitPercent / 100),
                timestamp: Date.now(),
                initialCapital: positionAmount,
            };

            this.positions.set(signal.tokenMint, position);
            this.currentCapital -= positionAmount;

            console.log(`🟢 Entered position:
                Token: ${signal.tokenMint}
                Price: $${signal.price}
                Amount: ${position.amount}
                Capital Used: $${positionAmount.toFixed(2)}
                Stop Loss: $${position.stopLoss}
                Take Profit: $${position.takeProfit}
                Remaining Capital: $${this.currentCapital.toFixed(2)}
                Reason: ${signal.reason}
            `);

            return true;
        } catch (error) {
            console.error("Failed to execute entry:", error);
            return false;
        }
    }

    public async executeExit(signal: TradeSignal): Promise<boolean> {
        try {
            const position = this.positions.get(signal.tokenMint);
            if (!position) return false;

            const profit =
                (signal.price - position.entryPrice) * position.amount;
            const profitPercent =
                ((signal.price - position.entryPrice) / position.entryPrice) *
                100;

            // Update capital and stats
            this.currentCapital += position.initialCapital + profit;
            this.stats.totalTrades++;
            if (profit > 0) {
                this.stats.winningTrades++;
                this.consecutiveLosses = 0;
            } else {
                this.consecutiveLosses++;
            }
            this.stats.totalProfit += profit;
            this.stats.currentCapital = this.currentCapital;
            this.stats.maxDrawdown = Math.min(
                this.stats.maxDrawdown,
                ((this.currentCapital - this.initialCapital) /
                    this.initialCapital) *
                    100
            );

            console.log(`🔴 Exited position:
                Token: ${signal.tokenMint}
                Entry: $${position.entryPrice}
                Exit: $${signal.price}
                Profit: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)
                Current Capital: $${this.currentCapital.toFixed(2)}
                Win Rate: ${((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1)}%
                Total Profit: $${this.stats.totalProfit.toFixed(2)}
                Max Drawdown: ${this.stats.maxDrawdown.toFixed(2)}%
                Reason: ${signal.reason}
            `);

            this.positions.delete(signal.tokenMint);
            return true;
        } catch (error) {
            console.error("Failed to execute exit:", error);
            return false;
        }
    }

    public getActivePositions(): Position[] {
        return Array.from(this.positions.values());
    }

    public getStats(): TradeStats {
        return { ...this.stats };
    }
}
