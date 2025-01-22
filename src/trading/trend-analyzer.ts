import { MarketDataService } from "./market-data-service";

export enum TrendDirection {
    BULLISH = "BULLISH",
    BEARISH = "BEARISH",
    SIDEWAYS = "SIDEWAYS",
}

export interface TrendAnalysis {
    direction: TrendDirection;
    strength: number; // 0-100%
    duration: number; // Duration in milliseconds
    priceChange: number; // Percentage
    volumeChange: number; // Percentage
    sma20: number; // 20-period Simple Moving Average
    sma50: number; // 50-period Simple Moving Average
    isReversal: boolean; // Whether a trend reversal is detected
    confidence: number; // 0-100%
}

export class TrendAnalyzer {
    private static instance: TrendAnalyzer;
    private readonly marketData: MarketDataService;
    private readonly minTrendStrength = 5; // Minimum % change to confirm trend
    private readonly reversalThreshold = 10; // % change to confirm reversal
    private readonly volumeWeight = 0.3; // Weight of volume in trend strength calculation
    private readonly priceWeight = 0.7; // Weight of price in trend strength calculation

    private constructor() {
        this.marketData = MarketDataService.getInstance();
    }

    public static getInstance(): TrendAnalyzer {
        if (!TrendAnalyzer.instance) {
            TrendAnalyzer.instance = new TrendAnalyzer();
        }
        return TrendAnalyzer.instance;
    }

    public analyzeTrend(tokenMint: string): TrendAnalysis | null {
        try {
            const history = this.marketData.getPriceHistory(tokenMint);
            if (history.length < 2) return null;

            // Calculate moving averages
            const sma20 = this.calculateSMA(history, 20);
            const sma50 = this.calculateSMA(history, 50);

            // Get current and historical data
            const currentPrice = history[history.length - 1].price;
            const currentVolume = history[history.length - 1].volume24h;
            const oldestPrice = history[0].price;
            const oldestVolume = history[0].volume24h;

            // Calculate changes
            const priceChange =
                ((currentPrice - oldestPrice) / oldestPrice) * 100;
            const volumeChange =
                ((currentVolume - oldestVolume) / oldestVolume) * 100;
            const duration =
                history[history.length - 1].timestamp - history[0].timestamp;

            // Determine trend direction
            const direction = this.determineTrendDirection(
                priceChange,
                sma20,
                sma50
            );

            // Calculate trend strength
            const priceStrength = Math.min(
                Math.abs(priceChange) / this.minTrendStrength,
                1
            );
            const volumeStrength = Math.min(
                Math.abs(volumeChange) / this.minTrendStrength,
                1
            );
            const strength =
                (priceStrength * this.priceWeight +
                    volumeStrength * this.volumeWeight) *
                100;

            // Check for reversal
            const isReversal = this.detectReversal(history, direction);

            // Calculate confidence
            const confidence = this.calculateConfidence(
                priceChange,
                volumeChange,
                strength,
                history.length
            );

            return {
                direction,
                strength,
                duration,
                priceChange: Number(priceChange.toFixed(2)),
                volumeChange: Number(volumeChange.toFixed(2)),
                sma20,
                sma50,
                isReversal,
                confidence: Number(confidence.toFixed(2)),
            };
        } catch (error) {
            console.error("Failed to analyze trend:", error);
            return null;
        }
    }

    private calculateSMA(history: { price: number }[], period: number): number {
        if (history.length < period) {
            return (
                history.reduce((sum, point) => sum + point.price, 0) /
                history.length
            );
        }

        const relevantPrices = history.slice(-period);
        const sum = relevantPrices.reduce(
            (total, point) => total + point.price,
            0
        );
        return Number((sum / period).toFixed(2));
    }

    private determineTrendDirection(
        priceChange: number,
        sma20: number,
        sma50: number
    ): TrendDirection {
        // Strong trend indicators
        const isBullish = priceChange > this.minTrendStrength && sma20 > sma50;
        const isBearish = priceChange < -this.minTrendStrength && sma20 < sma50;

        if (isBullish) return TrendDirection.BULLISH;
        if (isBearish) return TrendDirection.BEARISH;
        return TrendDirection.SIDEWAYS;
    }

    private detectReversal(
        history: { price: number }[],
        currentTrend: TrendDirection
    ): boolean {
        if (history.length < 3) return false;

        const recentPrices = history.slice(-3);
        const recentChange =
            ((recentPrices[2].price - recentPrices[0].price) /
                recentPrices[0].price) *
            100;

        // Check if recent price movement contradicts overall trend
        return (
            (currentTrend === TrendDirection.BULLISH &&
                recentChange < -this.reversalThreshold) ||
            (currentTrend === TrendDirection.BEARISH &&
                recentChange > this.reversalThreshold)
        );
    }

    private calculateConfidence(
        priceChange: number,
        volumeChange: number,
        strength: number,
        dataPoints: number
    ): number {
        // Factors that increase confidence:
        // 1. Strong price change
        // 2. Supporting volume change
        // 3. Trend strength
        // 4. Amount of data points

        const priceConfidence = Math.min(Math.abs(priceChange) / 20, 1) * 100;
        const volumeConfidence = Math.min(Math.abs(volumeChange) / 20, 1) * 100;
        const strengthConfidence = strength;
        const dataConfidence = Math.min(dataPoints / 10, 1) * 100;

        // Weight the factors
        return (
            priceConfidence * 0.4 +
            volumeConfidence * 0.2 +
            strengthConfidence * 0.3 +
            dataConfidence * 0.1
        );
    }
}
