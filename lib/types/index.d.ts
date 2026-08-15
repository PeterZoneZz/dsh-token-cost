/**
 * Host-side types of the token-cost plugin.
 * @module @dsh-user/dsh-token-cost
 */
/** Per-request token accounting projection published to clients. */
export interface TokenCostProjection {
    /** ISO 4217 currency code of the price table (CNY by default). */
    currency: string;
    /** Total estimated cost for the session, in `currency`. */
    cost: number;
    /** Total tokens across the four disjoint billing buckets. */
    tokens: {
        uncachedInput: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    /** Model ids with at least one priced usage sample, in first-use order. */
    models: string[];
    /** Per-model cost and token totals with the rates used. */
    byModel: Record<string, {
        cost: number;
        tokens: {
            uncachedInput: number;
            output: number;
            cacheRead: number;
            cacheWrite: number;
        };
        price: {
            input: number;
            cacheRead: number;
            cacheWrite: number;
            output: number;
        };
    }>;
}
export type { TokenCostProjection as default };
