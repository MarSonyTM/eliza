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
    private priceUpdateCallbacks: PriceUpdateCallback[] = [];
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
                console.log("🔌 Connected to Binance WebSocket");
                this.reconnectAttempts = 0;
                // Resubscribe to all symbols
                this.subscribedSymbols.forEach((symbol) =>
                    this.subscribeToSymbol(symbol)
                );
            });

            this.ws.on("message", (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.e === "trade") {
                        const update: PriceUpdate = {
                            symbol: message.s,
                            price: parseFloat(message.p),
                            timestamp: message.T,
                        };

                        // Update cache
                        this.priceCache.set(update.symbol, {
                            price: update.price,
                            timestamp: update.timestamp,
                        });

                        // Notify callbacks
                        this.priceUpdateCallbacks.forEach((callback) =>
                            callback(update)
                        );
                    }
                } catch (error) {
                    console.warn("Failed to parse WebSocket message:", error);
                }
            });

            this.ws.on("close", () => {
                console.log(
                    "WebSocket disconnected, attempting to reconnect..."
                );
                this.reconnect();
            });

            this.ws.on("error", (error) => {
                console.error("WebSocket error:", error);
                this.ws?.close();
            });
        } catch (error) {
            console.error("Failed to setup WebSocket:", error);
        }
    }

    private async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max reconnection attempts reached");
            return;
        }

        this.reconnectAttempts++;
        const delay =
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(
            `Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        this.setupWebSocket();
    }

    public subscribeToSymbol(symbol: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not ready, will subscribe when connected");
            this.subscribedSymbols.add(symbol);
            return;
        }

        const subscribeMsg = JSON.stringify({
            method: "SUBSCRIBE",
            params: [`${symbol.toLowerCase()}@trade`],
            id: Date.now(),
        });

        this.ws.send(subscribeMsg);
        this.subscribedSymbols.add(symbol);
    }

    public unsubscribeFromSymbol(symbol: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const unsubscribeMsg = JSON.stringify({
            method: "UNSUBSCRIBE",
            params: [`${symbol.toLowerCase()}@trade`],
            id: Date.now(),
        });

        this.ws.send(unsubscribeMsg);
        this.subscribedSymbols.delete(symbol);
    }

    public onPriceUpdate(callback: PriceUpdateCallback) {
        this.priceUpdateCallbacks.push(callback);
    }

    public removePriceUpdateCallback(callback: PriceUpdateCallback) {
        this.priceUpdateCallbacks = this.priceUpdateCallbacks.filter(
            (cb) => cb !== callback
        );
    }

    public getLastPrice(symbol: string): number | null {
        const cached = this.priceCache.get(symbol);
        return cached ? cached.price : null;
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
