import axios from "axios";

interface CoinGeckoPrice {
    [key: string]: {
        usd: number;
        usd_24h_change?: number;
    };
}

interface MarketData {
    current_price: number;
    price_change_24h: number;
    market_cap: number;
    total_volume: number;
}

export class CoinGeckoAPI {
    private static instance: CoinGeckoAPI;
    private readonly baseURL = "https://api.coingecko.com/api/v3";
    private readonly rateLimit = 50; // calls per minute
    private callCount = 0;
    private lastResetTime = Date.now();

    private constructor() {
        // Reset call count every minute
        setInterval(() => {
            this.callCount = 0;
            this.lastResetTime = Date.now();
        }, 60000);
    }

    public static getInstance(): CoinGeckoAPI {
        if (!CoinGeckoAPI.instance) {
            CoinGeckoAPI.instance = new CoinGeckoAPI();
        }
        return CoinGeckoAPI.instance;
    }

    private async checkRateLimit(): Promise<void> {
        if (this.callCount >= this.rateLimit) {
            const timeToWait = 60000 - (Date.now() - this.lastResetTime);
            if (timeToWait > 0) {
                await new Promise((resolve) => setTimeout(resolve, timeToWait));
            }
            this.callCount = 0;
            this.lastResetTime = Date.now();
        }
        this.callCount++;
    }

    // Get current price and 24h change
    public async getPriceData(
        coinId: string
    ): Promise<{ price: number; change24h: number }> {
        await this.checkRateLimit();
        try {
            const response = await axios.get<CoinGeckoPrice>(
                `${this.baseURL}/simple/price`,
                {
                    params: {
                        ids: coinId,
                        vs_currencies: "usd",
                        include_24hr_change: true,
                    },
                }
            );

            const data = response.data[coinId];
            return {
                price: data.usd,
                change24h: data.usd_24h_change || 0,
            };
        } catch (error) {
            console.error(`Error fetching price data for ${coinId}:`, error);
            throw error;
        }
    }

    // Get detailed market data
    public async getMarketData(coinId: string): Promise<MarketData> {
        await this.checkRateLimit();
        try {
            const response = await axios.get(
                `${this.baseURL}/coins/${coinId}`,
                {
                    params: {
                        localization: false,
                        tickers: false,
                        community_data: false,
                        developer_data: false,
                    },
                }
            );

            return {
                current_price: response.data.market_data.current_price.usd,
                price_change_24h:
                    response.data.market_data.price_change_percentage_24h,
                market_cap: response.data.market_data.market_cap.usd,
                total_volume: response.data.market_data.total_volume.usd,
            };
        } catch (error) {
            console.error(`Error fetching market data for ${coinId}:`, error);
            throw error;
        }
    }
}
