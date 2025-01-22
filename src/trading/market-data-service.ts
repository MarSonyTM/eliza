import { JupiterService } from "./jupiter-service";

interface PricePoint {
    timestamp: number;
    price: number;
    volume24h: number; // 24h trading volume in USD
}

interface MarketData {
    symbol: string;
    currentPrice: number;
    currentVolume24h: number;
    priceHistory: PricePoint[];
    lastUpdated: number;
    updateCount: number;
    errors: number;
    volumeChange24h: number; // Percentage change in 24h volume
}

export class MarketDataService {
    private static instance: MarketDataService;
    private readonly jupiter: JupiterService;
    private marketData: Map<string, MarketData>;
    private readonly updateInterval: number;
    private readonly historyLength: number;
    private readonly maxErrors = 3; // Maximum consecutive errors before alerting
    private updateIntervals: Map<string, ReturnType<typeof setInterval>>;

    private constructor(isTest = false) {
        this.jupiter = JupiterService.getInstance();
        this.marketData = new Map();
        this.updateIntervals = new Map();
        this.updateInterval = isTest ? 10 * 1000 : 60 * 1000; // 10 seconds in test, 1 minute in prod
        this.historyLength = isTest ? 10 : 24 * 60; // 10 points in test, 24 hours in prod
    }

    public static getInstance(isTest = false): MarketDataService {
        if (!MarketDataService.instance) {
            MarketDataService.instance = new MarketDataService(isTest);
        }
        return MarketDataService.instance;
    }

    public async initialize(): Promise<void> {
        try {
            await this.jupiter.initialize();
            console.log("📊 Market Data Service initialized");
        } catch (error) {
            console.error("Failed to initialize Market Data Service:", error);
            throw error;
        }
    }

    public async startTracking(tokenMint: string): Promise<void> {
        try {
            // Validate input
            if (!tokenMint || typeof tokenMint !== "string") {
                throw new Error("Invalid token mint address");
            }

            // Check if already tracking
            if (this.marketData.has(tokenMint)) {
                console.log(`Already tracking ${tokenMint}`);
                return;
            }

            // Get initial data
            const [currentPrice, volume24h] = await Promise.all([
                this.jupiter.getTokenPrice(tokenMint),
                this.jupiter.getTokenVolume(tokenMint),
            ]);

            if (currentPrice === null || isNaN(currentPrice)) {
                throw new Error(`Failed to get initial price for ${tokenMint}`);
            }

            if (volume24h === null || isNaN(volume24h)) {
                throw new Error(
                    `Failed to get initial volume for ${tokenMint}`
                );
            }

            const now = Date.now();

            this.marketData.set(tokenMint, {
                symbol: tokenMint,
                currentPrice,
                currentVolume24h: volume24h,
                priceHistory: [
                    {
                        timestamp: now,
                        price: currentPrice,
                        volume24h,
                    },
                ],
                lastUpdated: now,
                updateCount: 1,
                errors: 0,
                volumeChange24h: 0,
            });

            // Start periodic updates
            const interval = setInterval(async () => {
                await this.updatePrice(tokenMint);
            }, this.updateInterval);

            this.updateIntervals.set(tokenMint, interval);

            console.log(
                `Started tracking ${tokenMint} (update interval: ${this.updateInterval / 1000}s)`
            );
            console.log(`Initial 24h volume: $${volume24h.toLocaleString()}`);
        } catch (error) {
            console.error(`Failed to start tracking ${tokenMint}:`, error);
            throw error;
        }
    }

    public stopTracking(tokenMint: string): void {
        const interval = this.updateIntervals.get(tokenMint);
        if (interval) {
            clearInterval(interval);
            this.updateIntervals.delete(tokenMint);
            this.marketData.delete(tokenMint);
            console.log(`Stopped tracking ${tokenMint}`);
        }
    }

    private async updatePrice(tokenMint: string): Promise<void> {
        const data = this.marketData.get(tokenMint);
        if (!data) return;

        try {
            const [currentPrice, volume24h] = await Promise.all([
                this.jupiter.getTokenPrice(tokenMint),
                this.jupiter.getTokenVolume(tokenMint),
            ]);

            if (currentPrice === null || isNaN(currentPrice)) {
                throw new Error("Invalid price received");
            }

            if (volume24h === null || isNaN(volume24h)) {
                throw new Error("Invalid volume received");
            }

            const now = Date.now();
            const timeSinceLastUpdate = now - data.lastUpdated;

            // Validate update interval
            if (timeSinceLastUpdate < this.updateInterval * 0.9) {
                console.warn(`Update triggered too soon for ${tokenMint}`);
                return;
            }

            // Calculate volume change
            const volumeChange24h =
                ((volume24h - data.currentVolume24h) / data.currentVolume24h) *
                100;

            // Add new data point
            data.priceHistory.push({
                timestamp: now,
                price: currentPrice,
                volume24h,
            });

            // Keep only last N points of data
            if (data.priceHistory.length > this.historyLength) {
                data.priceHistory = data.priceHistory.slice(
                    -this.historyLength
                );
            }

            // Update data
            data.currentPrice = currentPrice;
            data.currentVolume24h = volume24h;
            data.volumeChange24h = Number(volumeChange24h.toFixed(2));
            data.lastUpdated = now;
            data.updateCount++;
            data.errors = 0; // Reset error count on successful update

            this.marketData.set(tokenMint, data);
            console.log(
                `Updated ${tokenMint}:` +
                    `\n  Price: $${currentPrice.toFixed(2)} (update #${data.updateCount})` +
                    `\n  24h Volume: $${volume24h.toLocaleString()}` +
                    `\n  Volume Change: ${volumeChange24h > 0 ? "+" : ""}${volumeChange24h.toFixed(2)}%`
            );
        } catch (error) {
            data.errors++;
            console.error(
                `Failed to update data for ${tokenMint} (error #${data.errors}):`,
                error
            );

            // Alert if too many consecutive errors
            if (data.errors >= this.maxErrors) {
                console.error(
                    `⚠️ WARNING: ${tokenMint} has had ${data.errors} consecutive update failures`
                );
            }
        }
    }

    public get24hChange(tokenMint: string): number | null {
        const data = this.marketData.get(tokenMint);
        if (!data || data.priceHistory.length < 2) return null;

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        // Find closest price point to 24h ago
        const oldestPoint = data.priceHistory
            .filter((point) => point.timestamp >= oneDayAgo)
            .sort((a, b) => a.timestamp - b.timestamp)[0];

        if (!oldestPoint) return null;

        // Calculate percentage change
        const change =
            ((data.currentPrice - oldestPoint.price) / oldestPoint.price) * 100;
        return Number(change.toFixed(2));
    }

    public getCurrentPrice(tokenMint: string): number | null {
        return this.marketData.get(tokenMint)?.currentPrice ?? null;
    }

    public getCurrentVolume(tokenMint: string): number | null {
        return this.marketData.get(tokenMint)?.currentVolume24h ?? null;
    }

    public getVolumeChange(tokenMint: string): number | null {
        return this.marketData.get(tokenMint)?.volumeChange24h ?? null;
    }

    public getPriceHistory(tokenMint: string): PricePoint[] {
        return this.marketData.get(tokenMint)?.priceHistory ?? [];
    }

    public getTrackedTokens(): string[] {
        return Array.from(this.marketData.keys());
    }

    public getUpdateStats(tokenMint: string): {
        updateCount: number;
        errors: number;
        lastUpdated: number;
        currentPrice: number;
        currentVolume24h: number;
        volumeChange24h: number;
    } | null {
        const data = this.marketData.get(tokenMint);
        if (!data) return null;

        return {
            updateCount: data.updateCount,
            errors: data.errors,
            lastUpdated: data.lastUpdated,
            currentPrice: data.currentPrice,
            currentVolume24h: data.currentVolume24h,
            volumeChange24h: data.volumeChange24h,
        };
    }
}
