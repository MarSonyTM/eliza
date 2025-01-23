import WebSocket from "ws";

interface PriceUpdate {
    symbol: string;
    price: number;
    timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

export class BinanceService {
    private static instance: BinanceService;
    private readonly wsBaseUrl = "wss://stream.binance.com:9443/ws";
    private ws: WebSocket | null = null;
    private priceCallbacks: Map<string, ((price: number) => void)[]> =
        new Map();
    private lastPrices: Map<string, number> = new Map();
    private subscribedSymbols: Set<string> = new Set();
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectDelay = 1000; // 1 second initial delay
    private priceCache: Map<string, { price: number; timestamp: number }> =
        new Map();

    private constructor() {
        this.setupWebSocket();
    }

    public static getInstance(): BinanceService {
        if (!BinanceService.instance) {
            BinanceService.instance = new BinanceService();
        }
        return BinanceService.instance;
    }

    private setupWebSocket() {
        try {
            this.ws = new WebSocket(this.wsBaseUrl);

            this.ws.on("open", () => {
                console.log("Connected to Binance WebSocket");
                this.reconnectAttempts = 0;
                this.subscribeToAllPairs();
            });

            this.ws.on("message", (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.e === "trade") {
                        const symbol = message.s;
                        const price = parseFloat(message.p);
                        this.lastPrices.set(symbol, price);

                        const callbacks = this.priceCallbacks.get(symbol);
                        if (callbacks) {
                            callbacks.forEach((callback) => callback(price));
                        }
                    }
                } catch (error) {
                    console.error("Error processing WebSocket message:", error);
                }
            });

            this.ws.on("close", () => {
                console.log("Binance WebSocket connection closed");
                this.handleReconnect();
            });

            this.ws.on("error", (error) => {
                console.error("Binance WebSocket error:", error);
                this.handleReconnect();
            });
        } catch (error) {
            console.error("Error setting up WebSocket:", error);
            this.handleReconnect();
        }
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(
                `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
            );
            setTimeout(
                () => this.setupWebSocket(),
                this.reconnectDelay * this.reconnectAttempts
            );
        } else {
            console.error("Max reconnection attempts reached");
        }
    }

    private subscribeToAllPairs() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const subscriptions = Array.from(this.priceCallbacks.keys()).map(
            (symbol) => ({
                method: "SUBSCRIBE",
                params: [`${symbol.toLowerCase()}@trade`],
                id: Date.now(),
            })
        );

        subscriptions.forEach((sub) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(sub));
            }
        });
    }

    public subscribeToPrice(symbol: string, callback: (price: number) => void) {
        if (!this.priceCallbacks.has(symbol)) {
            this.priceCallbacks.set(symbol, []);
        }
        this.priceCallbacks.get(symbol)?.push(callback);

        if (this.ws?.readyState === WebSocket.OPEN) {
            const subscription = {
                method: "SUBSCRIBE",
                params: [`${symbol.toLowerCase()}@trade`],
                id: Date.now(),
            };
            this.ws.send(JSON.stringify(subscription));
        }
    }

    public unsubscribeFromPrice(
        symbol: string,
        callback: (price: number) => void
    ) {
        const callbacks = this.priceCallbacks.get(symbol);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
            if (callbacks.length === 0) {
                this.priceCallbacks.delete(symbol);
                if (this.ws?.readyState === WebSocket.OPEN) {
                    const unsubscription = {
                        method: "UNSUBSCRIBE",
                        params: [`${symbol.toLowerCase()}@trade`],
                        id: Date.now(),
                    };
                    this.ws.send(JSON.stringify(unsubscription));
                }
            }
        }
    }

    public async getPrice(symbol: string): Promise<number> {
        const price = this.lastPrices.get(symbol);
        if (price !== undefined) {
            return price;
        }

        // If we don't have a cached price, fetch it from REST API
        try {
            const response = await fetch(
                `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const currentPrice = parseFloat(data.price);
            this.lastPrices.set(symbol, currentPrice);
            return currentPrice;
        } catch (error) {
            console.error("Error fetching price from Binance:", error);
            throw error;
        }
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public async getSymbolInfo(symbol: string): Promise<any> {
        try {
            const response = await fetch(
                `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Failed to get symbol info:", error);
            throw error;
        }
    }

    public async get24hVolume(symbol: string): Promise<number> {
        try {
            const info = await this.getSymbolInfo(symbol);
            return parseFloat(info.volume);
        } catch (error) {
            console.error("Failed to get 24h volume:", error);
            return 0;
        }
    }
}
