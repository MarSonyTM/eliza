import WebSocket from "ws";
import axios from "axios";

interface BinancePrice {
    symbol: string;
    price: string;
}

interface BinanceStreamData {
    symbol: string;
    price: string;
    timestamp: number;
}

export class BinanceAPI {
    private static instance: BinanceAPI;
    private ws: WebSocket | null = null;
    private readonly baseURL = "https://api.binance.com/api/v3";
    private readonly wsURL = "wss://stream.binance.com:9443/ws";

    private constructor() {}

    public static getInstance(): BinanceAPI {
        if (!BinanceAPI.instance) {
            BinanceAPI.instance = new BinanceAPI();
        }
        return BinanceAPI.instance;
    }

    // Get current price for a symbol
    public async getPrice(symbol: string): Promise<number> {
        try {
            const response = await axios.get<BinancePrice>(
                `${this.baseURL}/ticker/price`,
                {
                    params: { symbol: symbol.toUpperCase() },
                }
            );
            return parseFloat(response.data.price);
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error);
            throw error;
        }
    }

    // Subscribe to real-time price updates
    public subscribeToPriceUpdates(
        symbol: string,
        callback: (data: BinanceStreamData) => void
    ): void {
        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(this.wsURL);

        this.ws.on("open", () => {
            if (this.ws) {
                this.ws.send(
                    JSON.stringify({
                        method: "SUBSCRIBE",
                        params: [`${symbol.toLowerCase()}@trade`],
                        id: 1,
                    })
                );
            }
        });

        this.ws.on("message", (data: WebSocket.Data) => {
            const parsedData = JSON.parse(data.toString());
            if (parsedData.e === "trade") {
                callback({
                    symbol: parsedData.s,
                    price: parsedData.p,
                    timestamp: parsedData.T,
                });
            }
        });

        this.ws.on("error", (error) => {
            console.error("WebSocket error:", error);
        });
    }

    // Unsubscribe from price updates
    public unsubscribe(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
