import { BinanceAPI } from "./apis/binance";
import { CoinGeckoAPI } from "./apis/coingecko";
import { JupiterAPI } from "./apis/jupiter";
import { PriceAlertService } from "./price-alert-service";

interface PriceData {
    price: number;
    change24h: number;
    timestamp: number;
    source: string;
}

interface MarketData {
    price: PriceData;
    marketCap: number;
    volume: number;
    liquidity: boolean;
}

export class MarketDataService {
    private static instance: MarketDataService;
    private binanceAPI: BinanceAPI;
    private coingeckoAPI: CoinGeckoAPI;
    private jupiterAPI: JupiterAPI;
    private alertService: PriceAlertService;

    private priceUpdateCallbacks: Map<string, ((data: PriceData) => void)[]> =
        new Map();

    private constructor() {
        this.binanceAPI = BinanceAPI.getInstance();
        this.coingeckoAPI = CoinGeckoAPI.getInstance();
        this.jupiterAPI = JupiterAPI.getInstance();
        this.alertService = PriceAlertService.getInstance();
    }

    public static getInstance(): MarketDataService {
        if (!MarketDataService.instance) {
            MarketDataService.instance = new MarketDataService();
        }
        return MarketDataService.instance;
    }

    // Create price alert
    public createPriceAlert(
        symbol: string,
        condition: "above" | "below",
        price: number,
        callback: (price: number) => void
    ): string {
        return this.alertService.createAlert(
            symbol,
            condition,
            price,
            callback
        );
    }

    // Remove price alert
    public removePriceAlert(id: string): boolean {
        return this.alertService.removeAlert(id);
    }

    // Get all active alerts
    public getActiveAlerts() {
        return this.alertService.getActiveAlerts();
    }

    // Get aggregated price data from multiple sources
    public async getAggregatedPrice(
        symbol: string,
        coinId: string
    ): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        try {
            // Get Binance price
            const binancePrice = await this.binanceAPI.getPrice(symbol);
            prices.push({
                price: binancePrice,
                change24h: 0, // Binance needs separate call for 24h change
                timestamp: Date.now(),
                source: "binance",
            });
        } catch (error) {
            console.warn("Failed to fetch Binance price:", error);
        }

        try {
            // Get CoinGecko price
            const geckoData = await this.coingeckoAPI.getPriceData(coinId);
            prices.push({
                price: geckoData.price,
                change24h: geckoData.change24h,
                timestamp: Date.now(),
                source: "coingecko",
            });
        } catch (error) {
            console.warn("Failed to fetch CoinGecko price:", error);
        }

        return prices;
    }

    // Subscribe to real-time price updates
    public subscribeToPriceUpdates(
        symbol: string,
        callback: (data: PriceData) => void
    ): void {
        if (!this.priceUpdateCallbacks.has(symbol)) {
            this.priceUpdateCallbacks.set(symbol, []);

            // Subscribe to Binance WebSocket
            this.binanceAPI.subscribeToPriceUpdates(symbol, (data) => {
                const priceData: PriceData = {
                    price: parseFloat(data.price),
                    change24h: 0,
                    timestamp: data.timestamp,
                    source: "binance",
                };

                // Check price alerts
                this.alertService.checkPrice(symbol, priceData.price);

                this.priceUpdateCallbacks
                    .get(symbol)
                    ?.forEach((cb) => cb(priceData));
            });
        }

        this.priceUpdateCallbacks.get(symbol)?.push(callback);
    }

    // Unsubscribe from price updates
    public unsubscribeFromPriceUpdates(
        symbol: string,
        callback: (data: PriceData) => void
    ): void {
        const callbacks = this.priceUpdateCallbacks.get(symbol);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }

            if (callbacks.length === 0) {
                this.binanceAPI.unsubscribe();
                this.priceUpdateCallbacks.delete(symbol);
            }
        }
    }

    // Get comprehensive market data
    public async getMarketData(
        symbol: string,
        coinId: string,
        solanaTokenMint?: string
    ): Promise<MarketData> {
        const prices = await this.getAggregatedPrice(symbol, coinId);
        const geckoMarketData = await this.coingeckoAPI.getMarketData(coinId);

        let liquidity = true;
        if (solanaTokenMint) {
            try {
                liquidity = await this.jupiterAPI.checkLiquidity(
                    solanaTokenMint,
                    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC
                );
            } catch (error) {
                console.warn("Failed to check Solana liquidity:", error);
            }
        }

        return {
            price: prices[0], // Use first available price
            marketCap: geckoMarketData.market_cap,
            volume: geckoMarketData.total_volume,
            liquidity,
        };
    }
}
