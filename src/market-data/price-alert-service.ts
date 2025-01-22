interface PriceAlert {
    id: string;
    symbol: string;
    condition: "above" | "below";
    price: number;
    callback: (price: number) => void;
}

export class PriceAlertService {
    private static instance: PriceAlertService;
    private alerts: Map<string, PriceAlert> = new Map();

    private constructor() {}

    public static getInstance(): PriceAlertService {
        if (!PriceAlertService.instance) {
            PriceAlertService.instance = new PriceAlertService();
        }
        return PriceAlertService.instance;
    }

    public createAlert(
        symbol: string,
        condition: "above" | "below",
        price: number,
        callback: (price: number) => void
    ): string {
        const id = `${symbol}-${condition}-${price}-${Date.now()}`;
        this.alerts.set(id, { id, symbol, condition, price, callback });
        return id;
    }

    public removeAlert(id: string): boolean {
        return this.alerts.delete(id);
    }

    public checkPrice(symbol: string, currentPrice: number): void {
        this.alerts.forEach((alert) => {
            if (alert.symbol === symbol) {
                if (
                    (alert.condition === "above" &&
                        currentPrice > alert.price) ||
                    (alert.condition === "below" && currentPrice < alert.price)
                ) {
                    alert.callback(currentPrice);
                    this.removeAlert(alert.id); // Remove alert after triggering
                }
            }
        });
    }

    public getActiveAlerts(): PriceAlert[] {
        return Array.from(this.alerts.values());
    }
}
