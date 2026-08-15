/**
 * @dsh-user/dsh-token-cost — node half.
 *
 * Two host-side contributions, both zero-dependency:
 *
 * 1. The `tokenCost` session projection unit: a replay fold over the durable
 *    session log. `request/header` events pin the model that served each
 *    request; assistant usage events (provider-reported token counts) are then
 *    priced against that model's per-token rate and accumulated per model.
 *    Unlike a client-side "current model × total tokens" estimate, this is
 *    exact per request and stays correct across mid-session model switches and
 *    compaction. Priced with the built-in DeepSeek official price table
 *    (CNY per 1M tokens), overridable per model through the row config.
 *
 * 2. The /api/token-cost/* routes: a cached DeepSeek account balance lookup
 *    (`GET /user/balance` with the same credential ref the llm-deepseek
 *    adapter uses) and the effective price table, both consumed by the
 *    browser half.
 *
 * @module @dsh-user/dsh-token-cost
 */

/** Cordis plugin name. */
const name = "token-cost";

/** DeepSeek official prices in CNY per 1M tokens (Feb 2025 pricing). */
const DEFAULT_PRICES = Object.freeze({
	"deepseek-chat": { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 },
	"deepseek-reasoner": { input: 4, cacheRead: 1, cacheWrite: 4, output: 16 },
	"deepseek-v3": { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 },
	"deepseek-v4": { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 },
	"deepseek-v4-flash": { input: 1, cacheRead: 0.25, cacheWrite: 1, output: 4 },
	"default": { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 }
});

const FALLBACK_MODEL = "default";

/** Shallow-deep merge of user price overrides over the built-in table. */
function resolvePrices(overrides) {
	const table = {};
	for (const [model, rates] of Object.entries(DEFAULT_PRICES)) table[model] = { ...rates };
	if (overrides !== void 0 && overrides !== null) {
		for (const [model, rates] of Object.entries(overrides)) {
			if (rates === null || typeof rates !== "object") continue;
			table[model] = { ...(table[model] ?? {}), ...rates };
		}
	}
	return table;
}

/** Rates for one model id, falling back to the `default` row. */
function ratesOf(table, model) {
	const rates = table[model] ?? table[FALLBACK_MODEL] ?? table["deepseek-chat"];
	return rates ?? { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 };
}

/** Cost in CNY of one bucket set at the given per-1M-token rates. */
function costOf(buckets, rates) {
	return (
		buckets.uncachedInput * (rates.input ?? 0) +
		buckets.cacheRead * (rates.cacheRead ?? 0) +
		buckets.cacheWrite * (rates.cacheWrite ?? 0) +
		buckets.output * (rates.output ?? 0)
	) / 1e6;
}

/** Round to 4 decimals — plenty for CNY figures, keeps JSON tidy. */
function round4(value) {
	return Math.round(value * 1e4) / 1e4;
}

const zeroBuckets = () => ({ uncachedInput: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

const bucketsEqual = (left, right) =>
	left.uncachedInput === right.uncachedInput &&
	left.output === right.output &&
	left.cacheRead === right.cacheRead &&
	left.cacheWrite === right.cacheWrite;

/** Provider-reported usage of one event, if any (mirrors token-meter's read). */
function usageOf(event) {
	if (event.type === "assistant/chunk" && event.data?.chunk?.type === "usage") return event.data.chunk.usage;
	if (event.type === "assistant/message" && event.data?.usage !== void 0) return event.data.usage;
	return void 0;
}

/**
 * Pure fold for the tokenCost projection unit. State stays O(usage samples):
 * per-model running totals plus one `last` slot so a repeated sample for the
 * same (turn, step) replaces that step's earlier value instead of double
 * counting (the same session-log invariant token-meter relies on).
 *
 * @param state - previous fold state (shape of {@link initTokenCostState}).
 * @param event - one durable session event.
 * @param table - resolved price table.
 * @returns next state.
 */
function foldTokenCost(state, event, table) {
	if (event.type === "request/header") {
		const config = event.data?.header?.config;
		const model = config !== null && typeof config === "object" ? config.model : void 0;
		if (typeof model === "string" && model.length > 0) return { ...state, model };
		return state;
	}
	const usage = usageOf(event);
	if (usage === void 0) return state;
	let turn;
	let step;
	if (event.type === "assistant/chunk") ({ turn, step } = event.data);
	else ({ turn, step } = event.data);
	const buckets = {
		uncachedInput: usage.inputTokens ?? 0,
		output: usage.outputTokens ?? 0,
		cacheRead: usage.cacheReadTokens ?? 0,
		cacheWrite: usage.cacheWriteTokens ?? 0
	};
	const prev = state.last !== null && state.last.turn === turn && state.last.step === step ? state.last : null;
	if (prev !== null && bucketsEqual(prev.buckets, buckets)) return state;
	const model = typeof state.model === "string" && state.model.length > 0 ? state.model : FALLBACK_MODEL;

	const byModel = { ...state.byModel };
	const modelOrder = [...state.modelOrder];
	const totals = { ...state.totals };
	let cost = state.cost;

	const applyDelta = (targetModel, deltaBuckets, sign) => {
		const current = byModel[targetModel] ?? { cost: 0, tokens: zeroBuckets() };
		const rates = ratesOf(table, targetModel);
		byModel[targetModel] = {
			cost: round4(current.cost + sign * costOf(deltaBuckets, rates)),
			tokens: {
				uncachedInput: current.tokens.uncachedInput + sign * deltaBuckets.uncachedInput,
				output: current.tokens.output + sign * deltaBuckets.output,
				cacheRead: current.tokens.cacheRead + sign * deltaBuckets.cacheRead,
				cacheWrite: current.tokens.cacheWrite + sign * deltaBuckets.cacheWrite
			}
		};
		if (sign > 0 && !modelOrder.includes(targetModel)) modelOrder.push(targetModel);
	};

	if (prev !== null && prev.model !== model) {
		// Same step re-reported under a different header model: replace the old
		// sample entirely (the two headers for one step cannot both be true).
		applyDelta(prev.model, prev.buckets, -1);
		applyDelta(model, buckets, 1);
		cost = round4(cost - costOf(prev.buckets, ratesOf(table, prev.model)) + costOf(buckets, ratesOf(table, model)));
	} else if (prev !== null) {
		applyDelta(model, prev.buckets, -1);
		applyDelta(model, buckets, 1);
		cost = round4(cost - costOf(prev.buckets, ratesOf(table, model)) + costOf(buckets, ratesOf(table, model)));
	} else {
		applyDelta(model, buckets, 1);
		cost = round4(cost + costOf(buckets, ratesOf(table, model)));
	}

	return {
		...state,
		model,
		totals: {
			uncachedInput: totals.uncachedInput - (prev?.buckets.uncachedInput ?? 0) + buckets.uncachedInput,
			output: totals.output - (prev?.buckets.output ?? 0) + buckets.output,
			cacheRead: totals.cacheRead - (prev?.buckets.cacheRead ?? 0) + buckets.cacheRead,
			cacheWrite: totals.cacheWrite - (prev?.buckets.cacheWrite ?? 0) + buckets.cacheWrite
		},
		cost,
		byModel,
		modelOrder,
		last: { turn, step, model, buckets }
	};
}

/** Initial fold state. */
function initTokenCostState() {
	return { model: null, totals: zeroBuckets(), cost: 0, byModel: {}, modelOrder: [], last: null };
}

/** The projection value published to clients (and persisted via the cache). */
function viewTokenCost(state, table, currency) {
	const byModel = {};
	for (const model of state.modelOrder) {
		const entry = state.byModel[model];
		byModel[model] = {
			cost: entry.cost,
			tokens: { ...entry.tokens },
			price: { ...ratesOf(table, model) }
		};
	}
	return {
		currency,
		cost: round4(state.cost),
		tokens: { ...state.totals },
		models: [...state.modelOrder],
		byModel
	};
}

// ── account balance lookup ─────────────────────────────────────────────────

/**
 * Resolve the API key for the balance lookup: the credentials service first
 * (the same seam the llm-deepseek adapter uses, so the web Models page
 * configures it), then the launching environment.
 * @param ctx - plugin context.
 * @param cfg - resolved plugin config.
 * @returns the key, or null when absent.
 */
async function resolveApiKey(ctx, cfg) {
	const ref = cfg.balance?.apiKeyEnv ?? "DEEPSEEK_API_KEY";
	const credentials = ctx.get("credentials");
	if (credentials !== void 0) {
		try {
			const hit = await credentials.resolve(ref);
			if (hit !== void 0 && typeof hit.value === "string" && hit.value.length > 0) return hit.value;
		} catch {
			// fall through to the environment
		}
	}
	const ambient = process.env[ref];
	return typeof ambient === "string" && ambient.length > 0 ? ambient : null;
}

/** One balance snapshot; cached per plugin instance with a poll interval. */
function createBalanceStore(ctx, cfg) {
	let value = null;
	let at = 0;
	let inflight = null;
	const pollMs = Math.max(1e3, cfg.balance?.pollMs ?? 6e4);
	const baseUrl = (cfg.balance?.baseUrl ?? "https://api.deepseek.com").replace(/\/+$/, "");
	/** @returns a promise of the balance snapshot (shared while in flight). */
	const snapshot = () => {
		if (cfg.balance?.enabled === false) return Promise.resolve({ ok: false, code: "disabled" });
		const now = Date.now();
		if (value !== null && now - at < pollMs) return Promise.resolve(value);
		if (inflight !== null) return inflight;
		inflight = (async () => {
			try {
				const apiKey = await resolveApiKey(ctx, cfg);
				if (apiKey === null) {
					const result = { ok: false, code: "missing-key", ref: cfg.balance?.apiKeyEnv ?? "DEEPSEEK_API_KEY" };
					value = result;
					at = Date.now();
					return result;
				}
				const res = await fetch(`${baseUrl}/user/balance`, {
					headers: { authorization: `Bearer ${apiKey}` },
					signal: AbortSignal.timeout(8e3)
				});
				if (!res.ok) {
					const result = { ok: false, code: `http-${res.status}`, message: `balance endpoint returned ${res.status}` };
					value = result;
					at = Date.now();
					return result;
				}
				const body = await res.json();
				const result = { ok: true, fetchedAt: Date.now(), value: body };
				value = result;
				at = Date.now();
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const result = { ok: false, code: "fetch-failed", message };
				value = result;
				at = Date.now();
				return result;
			}
		})().finally(() => {
			inflight = null;
		});
		return inflight;
	};
	return { snapshot };
}

/**
 * Aggregate the tokenCost projection across every visible session: live
 * sessions fold through the projection registry; cold sessions read the
 * persisted projection cache (identity-checked, zero log loads). Mirrors the
 * session.list projection column, then sums the cost/token figures.
 * @param ctx - plugin context (services resolved lazily, each optional).
 * @returns the aggregate snapshot.
 */
async function aggregateTokenCost(ctx) {
	const rows = [];
	const seen = /* @__PURE__ */ new Set();
	const projections = ctx.get("sessionProjections");
	const cache = ctx.get("sessionProjectionCache");
	const sessions = ctx.get("sessions");
	if (sessions !== void 0) {
		for (const session of sessions.list()) {
			seen.add(session.id);
			try {
				const block = projections?.snapshot(session);
				if (block !== void 0 && block.values.tokenCost !== void 0) rows.push({ sessionId: session.id, block });
			} catch {
				// a broken fold never breaks the aggregate
			}
		}
	}
	const persistence = ctx.get("sessionPersistence");
	if (persistence !== void 0 && cache !== void 0) {
		try {
			const metas = await persistence.list();
			for (const meta of metas) {
				if (seen.has(meta.id)) continue;
				try {
					const block = cache.cachedSnapshot(meta);
					if (block !== void 0 && block.values.tokenCost !== void 0) rows.push({ sessionId: meta.id, block });
				} catch {
					// skip sessions whose cache row is unusable
				}
			}
		} catch {
			// persistence listing is best-effort
		}
	}
	const totals = { uncachedInput: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
	const byModel = {};
	let cost = 0;
	let currency = "CNY";
	for (const row of rows) {
		const proj = row.block.values.tokenCost;
		if (proj === null || typeof proj !== "object") continue;
		currency = typeof proj.currency === "string" ? proj.currency : currency;
		cost += typeof proj.cost === "number" ? proj.cost : 0;
		const tokens = proj.tokens ?? {};
		totals.uncachedInput += tokens.uncachedInput ?? 0;
		totals.output += tokens.output ?? 0;
		totals.cacheRead += tokens.cacheRead ?? 0;
		totals.cacheWrite += tokens.cacheWrite ?? 0;
		const models = Array.isArray(proj.models) ? proj.models : [];
		for (const model of models) {
			const entry = proj.byModel?.[model];
			if (entry === null || typeof entry !== "object") continue;
			const current = byModel[model] ?? { cost: 0, tokens: { uncachedInput: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
			current.cost += typeof entry.cost === "number" ? entry.cost : 0;
			current.tokens.uncachedInput += entry.tokens?.uncachedInput ?? 0;
			current.tokens.output += entry.tokens?.output ?? 0;
			current.tokens.cacheRead += entry.tokens?.cacheRead ?? 0;
			current.tokens.cacheWrite += entry.tokens?.cacheWrite ?? 0;
			byModel[model] = current;
		}
	}
	return {
		currency,
		cost: round4(cost),
		sessions: rows.length,
		tokens: totals,
		byModel,
		updatedAt: Date.now()
	};
}

/**
 * Host plugin body: register the tokenCost projection unit and the
 * /api/token-cost routes.
 * @param ctx - host plugin context.
 * @param config - raw row config (merged with defaults here; no schema step).
 */
function apply(ctx, config = {}) {
	const table = resolvePrices(config.prices);
	const currency = typeof config.currency === "string" && config.currency.length > 0 ? config.currency : "CNY";

	ctx.inject(["sessionProjections"], (projectionCtx) => {
		const definition = {
			key: "tokenCost",
			// No external schema library: the registry only calls parse() to
			// validate/transform the view output; pass-through keeps the fold's
			// already-plain JSON value as published.
			schema: { parse: (value) => value },
			init: initTokenCostState,
			apply: (state, event) => foldTokenCost(state, event, table),
			view: (state) => viewTokenCost(state, table, currency),
			stateVersion: 1
		};
		projectionCtx.effect(() => projectionCtx.sessionProjections.register(definition), "token-cost: tokenCost projection unit");
	});

	const balance = createBalanceStore(ctx, config);
	ctx.inject(["webServer"], (webCtx) => {
		webCtx.effect(() => webCtx.webServer.register({
			kind: "prefix",
			path: "/api/token-cost",
			handler: async (req, res) => {
				const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
				try {
					if (pathname === "/api/token-cost/balance") {
						res.writeHead(200, {
							"content-type": "application/json; charset=utf-8",
							"cache-control": "no-store"
						});
						res.end(JSON.stringify(await balance.snapshot()));
						return;
					}
					if (pathname === "/api/token-cost/prices") {
						res.writeHead(200, {
							"content-type": "application/json; charset=utf-8",
							"cache-control": "no-store"
						});
						res.end(JSON.stringify({ currency, prices: table }));
						return;
					}
					if (pathname === "/api/token-cost/summary") {
						res.writeHead(200, {
							"content-type": "application/json; charset=utf-8",
							"cache-control": "no-store"
						});
						res.end(JSON.stringify(await aggregateTokenCost(webCtx)));
						return;
					}
					res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
					res.end(JSON.stringify({ ok: false, code: "not-found" }));
				} catch (error) {
					// Never leave the socket hanging on an aggregate failure.
					try {
						res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
						res.end(JSON.stringify({ ok: false, code: "internal", message: error instanceof Error ? error.message : String(error) }));
					} catch {
						res.destroy();
					}
				}
			}
		}), "token-cost: /api/token-cost routes");
	});
}

export { DEFAULT_PRICES, apply, foldTokenCost, initTokenCostState, name, resolvePrices, viewTokenCost };
