export interface PricePoint {
    price: number;
    timestamp: number;
}

export class VisualizationService {
    private static instance: VisualizationService;
    private priceHistory: Map<string, PricePoint[]> = new Map();
    private readonly maxDataPoints = 50; // Keep last 50 price points

    private constructor() {}

    public static getInstance(): VisualizationService {
        if (!VisualizationService.instance) {
            VisualizationService.instance = new VisualizationService();
        }
        return VisualizationService.instance;
    }

    public addPricePoint(
        symbol: string,
        price: number,
        timestamp: number
    ): void {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol)!;
        history.push({ price, timestamp });

        // Keep only last maxDataPoints
        if (history.length > this.maxDataPoints) {
            history.shift();
        }
    }

    public displayPriceChart(symbol: string): void {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 2) {
            console.log("Not enough data points for visualization");
            return;
        }

        const prices = history.map((p) => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const chartHeight = 10;

        console.log(
            `\nPrice Chart for ${symbol} (Last ${history.length} updates)`
        );
        console.log(
            `Max: $${max.toFixed(2)} | Min: $${min.toFixed(2)} | Range: $${range.toFixed(2)}`
        );
        console.log("-".repeat(50));

        // Create chart
        for (let i = chartHeight - 1; i >= 0; i--) {
            const line = prices
                .map((price) => {
                    const normalizedPrice = (price - min) / range;
                    const position = normalizedPrice * (chartHeight - 1);
                    return Math.round(position) === i ? "•" : " ";
                })
                .join("");

            const price = max - i * (range / (chartHeight - 1));
            console.log(`$${price.toFixed(2)} |${line}`);
        }
        console.log("-".repeat(50));

        // Show trend indicators
        const trend = prices[prices.length - 1] - prices[0];
        const trendSymbol = trend > 0 ? "↗️" : trend < 0 ? "↘️" : "➡️";
        console.log(
            `Trend: ${trendSymbol} ${Math.abs(trend).toFixed(2)} (${trend > 0 ? "+" : ""}${((trend / prices[0]) * 100).toFixed(2)}%)`
        );
    }

    public displayStats(symbol: string): void {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 2) {
            console.log("Not enough data for statistics");
            return;
        }

        const prices = history.map((p) => p.price);
        const latest = prices[prices.length - 1];
        const earliest = prices[0];
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const volatility = Math.sqrt(
            prices.map((p) => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) /
                prices.length
        );

        console.log("\nPrice Statistics:");
        console.log(`Current Price: $${latest.toFixed(2)}`);
        console.log(`Average Price: $${avg.toFixed(2)}`);
        console.log(
            `Price Change: ${(((latest - earliest) / earliest) * 100).toFixed(2)}%`
        );
        console.log(`Volatility: ${volatility.toFixed(4)}`);
    }

    public clearHistory(symbol: string): void {
        this.priceHistory.delete(symbol);
    }

    public getPriceHistory(symbol: string): number[] {
        const history = this.priceHistory.get(symbol);
        if (!history) return [];
        return history.map((point) => point.price);
    }
}
