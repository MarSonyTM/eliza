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
    private readonly minRequestInterval = 1500; // 1.5 seconds between requests (to respect rate limits)

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

    private async rateLimitedFetch(
        url: string,
        retries = 3
    ): Promise<Response> {
        for (let i = 0; i < retries; i++) {
            try {
                // Ensure minimum time between requests
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    await this.sleep(
                        this.minRequestInterval - timeSinceLastRequest
                    );
                }

                this.lastRequestTime = Date.now();
                const response = await fetch(url);

                if (response.status === 429) {
                    const retryAfter = parseInt(
                        response.headers.get("retry-after") || "60"
                    );
                    console.log(
                        `Rate limited by CoinGecko, waiting ${retryAfter}s before retry`
                    );
                    await this.sleep(retryAfter * 1000);
                    continue;
                }

                return response;
            } catch (error) {
                if (i === retries - 1) throw error;
                const backoffTime = Math.min(1000 * Math.pow(2, i), 10000);
                console.warn(`Request failed, retrying in ${backoffTime}ms...`);
                await this.sleep(backoffTime);
            }
        }
        throw new Error(`Failed after ${retries} retries`);
    }

    public async getPriceData(coinIds: string[]): Promise<CoinGeckoPrice> {
        try {
            // Check cache first
            const cacheKey = coinIds.sort().join(",");
            const cached = this.priceCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                return cached.data;
            }

            const response = await this.rateLimitedFetch(
                `${this.baseUrl}/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as CoinGeckoPrice;

            // Cache the result
            this.priceCache.set(cacheKey, {
                data,
                timestamp: Date.now(),
            });

            return data;
        } catch (error) {
            console.error("Failed to get price data from CoinGecko:", error);
            // Return cached data if available
            const cached = this.priceCache.get(coinIds.sort().join(","));
            if (cached) return cached.data;
            throw error;
        }
    }

    public async getPrice(coinId: string): Promise<number> {
        const data = await this.getPriceData([coinId]);
        return data[coinId]?.usd || 0;
    }

    public async get24hVolume(coinId: string): Promise<number> {
        const data = await this.getPriceData([coinId]);
        return data[coinId]?.usd_24h_vol || 0;
    }

    public async get24hChange(coinId: string): Promise<number> {
        const data = await this.getPriceData([coinId]);
        return data[coinId]?.usd_24h_change || 0;
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
