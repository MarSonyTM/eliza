import { PricePoint } from "../market-data/visualization-service";

interface MLPrediction {
    predictedPrice: number;
    confidence: number;
    timeframe: "1h" | "4h" | "24h";
}

interface FeatureSet {
    price: number;
    volume: number;
    timestamp: number;
    priceChange24h: number;
    volatility: number;
}

export class MLStrategy {
    private static instance: MLStrategy;
    private historicalData: Map<string, FeatureSet[]> = new Map();
    private predictions: Map<string, MLPrediction[]> = new Map();
    private readonly maxHistoryPoints = 1000;
    private learningRate = 0.01;

    private constructor() {
        this.initializeModel();
    }

    public static getInstance(): MLStrategy {
        if (!MLStrategy.instance) {
            MLStrategy.instance = new MLStrategy();
        }
        return MLStrategy.instance;
    }

    private initializeModel(): void {
        console.log("🧠 Initializing ML Model...");
        // Initialize weights for our simple neural network
        this.weights = {
            price: 0.4,
            volume: 0.2,
            priceChange: 0.2,
            volatility: 0.2,
        };
    }

    public addDataPoint(
        symbol: string,
        price: number,
        volume: number,
        priceChange24h: number
    ): void {
        if (!this.historicalData.has(symbol)) {
            this.historicalData.set(symbol, []);
        }

        const history = this.historicalData.get(symbol)!;
        const volatility = this.calculateVolatility(
            history.map((h) => h.price)
        );

        const dataPoint: FeatureSet = {
            price,
            volume,
            timestamp: Date.now(),
            priceChange24h,
            volatility,
        };

        history.push(dataPoint);
        if (history.length > this.maxHistoryPoints) {
            history.shift();
        }

        // Generate new predictions when we get new data
        this.updatePredictions(symbol);
    }

    private weights: { [key: string]: number } = {};

    private updatePredictions(symbol: string): void {
        const history = this.historicalData.get(symbol);
        if (!history || history.length < 24) return; // Need at least 24 hours of data

        const predictions: MLPrediction[] = [];
        const latestFeatures = history[history.length - 1];

        // Generate predictions for different timeframes
        ["1h", "4h", "24h"].forEach((timeframe) => {
            const predictedChange = this.predictPriceChange(latestFeatures);
            const confidence = this.calculateConfidence(
                history,
                predictedChange
            );

            predictions.push({
                predictedPrice: latestFeatures.price * (1 + predictedChange),
                confidence,
                timeframe: timeframe as "1h" | "4h" | "24h",
            });
        });

        this.predictions.set(symbol, predictions);
    }

    private predictPriceChange(features: FeatureSet): number {
        // Simple weighted combination of features
        return (
            features.priceChange24h * this.weights.price +
            (features.volume / 1000000) * this.weights.volume +
            features.volatility * this.weights.volatility
        );
    }

    private calculateConfidence(
        history: FeatureSet[],
        prediction: number
    ): number {
        // Calculate confidence based on historical prediction accuracy
        // Returns a value between 0 and 1
        return Math.min(0.95, 0.5 + Math.abs(prediction) * 0.1);
    }

    private calculateVolatility(prices: number[]): number {
        if (prices.length < 2) return 0;
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        return Math.sqrt(
            returns.reduce((a, b) => a + b * b, 0) / returns.length
        );
    }

    public getPrediction(symbol: string): MLPrediction | null {
        const predictions = this.predictions.get(symbol);
        if (!predictions || predictions.length === 0) return null;

        // Return the prediction with highest confidence
        return predictions.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
        );
    }

    public updateModelFromTradeResult(
        symbol: string,
        successful: boolean,
        profitLoss: number
    ): void {
        // Adjust weights based on trade results
        const adjustment = successful ? this.learningRate : -this.learningRate;

        Object.keys(this.weights).forEach((key) => {
            this.weights[key] += adjustment * Math.sign(profitLoss);
        });

        // Normalize weights
        const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
        Object.keys(this.weights).forEach((key) => {
            this.weights[key] /= sum;
        });

        console.log("\n🧠 Model updated from trade result:");
        console.log(`Success: ${successful}, PnL: $${profitLoss.toFixed(2)}`);
        console.log("New weights:", this.weights);
    }
}
