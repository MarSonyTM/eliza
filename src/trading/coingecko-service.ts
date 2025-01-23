interface CoinGeckoPrice {
    [key: string]: {
        usd: number;
        usd_24h_vol: number;
        usd_24h_change: number;
        last_updated_at: number;
    };
}

export class CoinGeckoService {
    private static instance: CoinGeckoService;
    private readonly baseUrl = "https://api.coingecko.com/api/v3";
    private priceCache: Map<
        string,
        { data: CoinGeckoPrice; timestamp: number }
    > = new Map();
    private readonly cacheDuration = 30000; // 30 seconds cache
    private lastRequestTime = 0;
    private readonly minRequestInterval = 500; // 500ms between requests

    private constructor() {}

    public static getInstance(): CoinGeckoService {
        if (!CoinGeckoService.instance) {
            CoinGeckoService.instance = new CoinGeckoService();
        }
        return CoinGeckoService.instance;
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async rateLimitedFetch(url: string): Promise<Response> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            await this.sleep(this.minRequestInterval - timeSinceLastRequest);
        }

        this.lastRequestTime = Date.now();
        return fetch(url);
    }

    public async getPriceData(coins: string[]): Promise<CoinGeckoPrice> {
        try {
            const ids = coins.join(",");
            const response = await this.rateLimitedFetch(
                `${this.baseUrl}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data as CoinGeckoPrice;
        } catch (error) {
            console.error("Error fetching price data from CoinGecko:", error);
            throw error;
        }
    }

    public async getPrice(coin: string): Promise<number> {
        // Check cache first
        const cached = this.priceCache.get(coin);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data[coin]?.usd || 0;
        }

        try {
            const data = await this.getPriceData([coin]);
            const price = data[coin]?.usd || 0;

            // Update cache
            this.priceCache.set(coin, {
                data,
                timestamp: Date.now(),
            });

            return price;
        } catch (error) {
            console.error("Error fetching price from CoinGecko:", error);
            throw error;
        }
    }

    public async get24hVolume(coin: string): Promise<number> {
        try {
            const data = await this.getPriceData([coin]);
            return data[coin]?.usd_24h_vol || 0;
        } catch (error) {
            console.error("Error fetching 24h volume from CoinGecko:", error);
            throw error;
        }
    }

    public async get24hChange(coin: string): Promise<number> {
        try {
            const data = await this.getPriceData([coin]);
            return data[coin]?.usd_24h_change || 0;
        } catch (error) {
            console.error("Error fetching 24h change from CoinGecko:", error);
            throw error;
        }
    }

    public async validatePrice(
        coinId: string,
        price: number,
        maxDifference = 1
    ): Promise<boolean> {
        try {
            const geckoPrice = await this.getPrice(coinId);
            if (geckoPrice === 0) return false;

            const difference = Math.abs(
                ((price - geckoPrice) / geckoPrice) * 100
            );
            return difference <= maxDifference;
        } catch (error) {
            console.warn("Price validation failed:", error);
            return true; // If validation fails, assume price is valid to avoid disrupting trading
        }
    }
}
