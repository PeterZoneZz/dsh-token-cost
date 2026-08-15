/**
 * @dsh-user/dsh-token-cost — browser half.
 *
 * A draggable floating whale (DeepSeek mark) with a click-open detail card,
 * in the style of Doubao / Youdao-style helper widgets:
 *
 * - The whale is a small frosted-glass orb pinned to the viewport. Drag it to
 *   move (with left/right edge snapping, remembered in localStorage); a click
 *   (press without movement) toggles the card. While the card is open,
 *   dragging the whale moves card and whale together instead of closing it.
 * - The card anchors to the whale on the side with the most viewport room,
 *   with a pointer arrow toward the whale, and closes on outside click,
 *   Escape, the close button, or another click on the whale.
 * - Content: this session's token usage and cost, the DeepSeek account
 *   balance (official /user/balance endpoint) with a spend-share progress
 *   bar, and the aggregated spend across every session. A balance ring wraps
 *   the whale.
 *
 * Costs are computed host-side per request (priced by the model that served
 * each request), so this bundle never estimates from client-side aggregates.
 *
 * @module @dsh-user/dsh-token-cost/client
 */
window.__ModuleLoader__.load({
	id: "@dsh-user/dsh-token-cost",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region token-cost styles
		const css = `
.tc-widget{position:fixed;z-index:150;display:inline-flex}
.tc-fabWrap{position:relative;display:inline-flex}
.tc-ring{position:absolute;inset:-5px;pointer-events:none;transition:opacity .2s}
.tc-ringSvg{display:block;transform:rotate(-90deg);overflow:visible}
.tc-ringTrack{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:3}
.tc-ringFill{fill:none;stroke-width:3;stroke-linecap:round;transition:stroke-dashoffset .5s ease,stroke .5s ease;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--tc-glow,#4d6bfe) 55%,transparent))}
.tc-fab{display:inline-grid;place-items:center;width:44px;height:44px;border:1px solid var(--dsw-alias-border-l3);border-radius:999px;background:var(--dsw-specific-menu);color:var(--dsw-static-blue-450);box-shadow:var(--dsw-shadow-lv2);cursor:grab;padding:0;transition:box-shadow .15s,transform .15s,border-color .15s,opacity .2s;user-select:none;-webkit-user-select:none;touch-action:none}
.tc-fab:hover{border-color:var(--dsw-alias-border-inverted);box-shadow:var(--dsw-shadow-lv3);transform:scale(1.06)}
.tc-fab:hover .tc-fish{animation:tcWiggle .55s ease}
.tc-fab:active{cursor:grabbing;transform:scale(.96)}
.tc-fabDragging{cursor:grabbing;box-shadow:var(--dsw-shadow-lv3);transform:scale(1.04)}
.tc-fabDim{opacity:.5}
.tc-fish{display:inline-flex}
@keyframes tcWiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}60%{transform:rotate(7deg)}80%{transform:rotate(-4deg)}}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
.tc-fab,.tc-panel{background:color-mix(in srgb,var(--dsw-specific-menu) 82%,transparent);backdrop-filter:blur(16px) saturate(1.5);-webkit-backdrop-filter:blur(16px) saturate(1.5)}
}
.tc-panel{z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:316px;max-width:calc(100vw - 24px);max-height:min(480px,calc(100vh - 24px));box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-secondary);border-radius:16px;padding:12px 14px;font-size:12px;line-height:20px;cursor:default;overflow-y:auto;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.tc-panelRight{position:absolute;left:calc(100% + 12px);animation:tcPop .16s ease}
.tc-panelLeft{position:absolute;right:calc(100% + 12px);animation:tcPop .16s ease}
.tc-panelDown{position:absolute;top:calc(100% + 12px);animation:tcPop .16s ease}
.tc-panelUp{position:absolute;bottom:calc(100% + 12px);animation:tcPop .16s ease}
@keyframes tcPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
.tc-panel::before{content:"";position:absolute;width:10px;height:10px;background:inherit;border:1px solid var(--dsw-alias-border-inverted)}
.tc-panelRight::before{left:-6px;top:var(--tc-arrow,50%);transform:translateY(-50%) rotate(45deg);border-right:0;border-top:0}
.tc-panelLeft::before{right:-6px;top:var(--tc-arrow,50%);transform:translateY(-50%) rotate(45deg);border-left:0;border-bottom:0}
.tc-panelDown::before{top:-6px;left:var(--tc-arrow,50%);transform:translateX(-50%) rotate(45deg);border-right:0;border-bottom:0}
.tc-panelUp::before{bottom:-6px;left:var(--tc-arrow,50%);transform:translateX(-50%) rotate(45deg);border-left:0;border-top:0}
.tc-panelHeader{display:flex;align-items:center;gap:7px;font-weight:600;color:var(--dsw-alias-label-primary);font-size:13px;padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l2);margin-bottom:8px}
.tc-panelHeaderIcon{display:inline-flex;color:var(--dsw-static-blue-450);flex:none}
.tc-panelClose{margin-left:auto;display:inline-grid;place-items:center;width:22px;height:22px;border:0;border-radius:7px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:14px;line-height:1}
.tc-panelClose:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.tc-hero{display:flex;align-items:center;gap:12px;border-radius:12px;padding:10px 12px;margin-bottom:10px;background:linear-gradient(135deg,#4d6bfe 0%,#3b5bdb 55%,#2f4fd0 100%);color:#fff;position:relative;overflow:hidden}
.tc-hero::after{content:"";position:absolute;right:-30px;top:-30px;width:110px;height:110px;border-radius:999px;background:radial-gradient(circle,color-mix(in srgb,#fff 26%,transparent),transparent 70%);pointer-events:none}
.tc-heroRing{position:relative;width:64px;height:64px;flex:none;display:inline-grid;place-items:center}
.tc-heroRingSvg{position:absolute;inset:0;transform:rotate(-90deg);overflow:visible}
.tc-heroRingTrack{fill:none;stroke:color-mix(in srgb,#fff 28%,transparent);stroke-width:4}
.tc-heroRingFill{fill:none;stroke-width:4;stroke-linecap:round;transition:stroke-dashoffset .6s ease}
.tc-heroRingNum{position:relative;font-size:15px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}
.tc-heroMain{min-width:0;flex:1}
.tc-heroLabel{font-size:11px;line-height:16px;color:color-mix(in srgb,#fff 82%,transparent)}
.tc-heroBalance{font-size:22px;line-height:28px;font-weight:700;letter-spacing:-.01em;font-variant-numeric:tabular-nums;display:inline-block}
.tc-heroBalance.tc-numPop{animation:tcNumPop .35s ease}
@keyframes tcNumPop{0%{opacity:.35;transform:translateY(3px)}100%{opacity:1;transform:none}}
.tc-heroSub{margin-top:2px;display:flex;flex-wrap:wrap;gap:2px 10px;font-size:11px;line-height:16px;color:color-mix(in srgb,#fff 78%,transparent);font-variant-numeric:tabular-nums}
.tc-heroPill{font-size:11px;line-height:18px;font-weight:600;border-radius:999px;padding:0 8px;background:color-mix(in srgb,#fff 20%,transparent);color:#fff;font-variant-numeric:tabular-nums}
.tc-section{margin-bottom:8px}
.tc-sectionLabel{display:flex;align-items:center;gap:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin-bottom:2px}
.tc-sectionBody{padding:6px 8px;border-radius:10px;background:var(--dsw-alias-fill-l1)}
.tc-row{display:flex;align-items:baseline;gap:8px;padding:2px 0}
.tc-rowLabel{color:var(--dsw-alias-label-tertiary);flex:none}
.tc-rowValue{margin-left:auto;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.tc-big{font-size:16px;line-height:22px;font-weight:700;letter-spacing:-.01em}
.tc-buckets{display:flex;flex-wrap:wrap;gap:4px 6px;padding:4px 0 2px;font-variant-numeric:tabular-nums}
.tc-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;line-height:18px;color:var(--dsw-alias-label-secondary);font-size:11px;background:var(--dsw-specific-menu)}
.tc-chipNum{color:var(--dsw-alias-label-primary);font-weight:500}
.tc-swatch{width:7px;height:7px;border-radius:2px;flex:none}
.tc-segInput{background:var(--dsw-static-blue-450)}
.tc-segRead{background:#a78bfa}
.tc-segWrite{background:var(--dsw-static-neutral-bluish-400)}
.tc-segOutput{background:#34d399}
.tc-sub{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
.tc-models{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;padding-top:2px}
.tc-note{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2);margin-top:6px}
.tc-degraded{color:var(--dsw-alias-label-tertiary);font-style:italic}
`;
		const tagId = "@dsh-user/dsh-token-cost/token-cost.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-user/dsh-token-cost";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const styles = {
			widget: "tc-widget",
			fabWrap: "tc-fabWrap",
			ring: "tc-ring",
			ringSvg: "tc-ringSvg",
			ringTrack: "tc-ringTrack",
			ringFill: "tc-ringFill",
			fab: "tc-fab",
			fabDragging: "tc-fabDragging",
			fabDim: "tc-fabDim",
			fish: "tc-fish",
			panel: "tc-panel",
			panelRight: "tc-panelRight",
			panelLeft: "tc-panelLeft",
			panelDown: "tc-panelDown",
			panelUp: "tc-panelUp",
			panelHeader: "tc-panelHeader",
			panelHeaderIcon: "tc-panelHeaderIcon",
			panelClose: "tc-panelClose",
			hero: "tc-hero",
			heroRing: "tc-heroRing",
			heroRingSvg: "tc-heroRingSvg",
			heroRingTrack: "tc-heroRingTrack",
			heroRingFill: "tc-heroRingFill",
			heroRingNum: "tc-heroRingNum",
			heroMain: "tc-heroMain",
			heroLabel: "tc-heroLabel",
			heroBalance: "tc-heroBalance",
			heroSub: "tc-heroSub",
			heroPill: "tc-heroPill",
			numPop: "tc-numPop",
			section: "tc-section",
			sectionLabel: "tc-sectionLabel",
			sectionBody: "tc-sectionBody",
			row: "tc-row",
			rowLabel: "tc-rowLabel",
			rowValue: "tc-rowValue",
			big: "tc-big",
			buckets: "tc-buckets",
			chip: "tc-chip",
			chipNum: "tc-chipNum",
			swatch: "tc-swatch",
			segInput: "tc-segInput",
			segRead: "tc-segRead",
			segWrite: "tc-segWrite",
			segOutput: "tc-segOutput",
			sub: "tc-sub",
			models: "tc-models",
			note: "tc-note",
			degraded: "tc-degraded"
		};
		//#endregion
		//#region locales
		/** `token-cost` namespace dictionaries. */
		const zh = {
			"widget.title": "Token 用量与费用",
			"widget.aria": "Token 用量与费用（点击展开，拖动可移动）",
			"widget.close": "关闭",
			"session.label": "本次会话",
			"bucket.input": "输入",
			"bucket.cacheRead": "缓存读",
			"bucket.cacheWrite": "缓存写",
			"bucket.output": "输出",
			"balance.title": "账户余额",
			"balance.remaining": "剩余 {percent}%",
			"balance.consumed": "本次消耗",
			"balance.granted": "赠送",
			"balance.toppedUp": "充值",
			"balance.missingKey": "未配置 API Key（DEEPSEEK_API_KEY）",
			"balance.disabled": "余额查询未启用",
			"balance.fetchFailed": "余额查询失败",
			"balance.http": "余额查询失败（{code}）",
			"total.title": "累计花费",
			"total.sessions": "共 {n} 个会话",
			"total.unavailable": "累计数据不可用",
			"note": "按 DeepSeek 官方价估算，价格可在 profile 配置中调整",
			"updated": "更新于 {time}",
			"unknown": "未知模型"
		};
		const en = {
			"widget.title": "Tokens & cost",
			"widget.aria": "Token usage and cost (click to open, drag to move)",
			"widget.close": "Close",
			"session.label": "This session",
			"bucket.input": "Input",
			"bucket.cacheRead": "Cache read",
			"bucket.cacheWrite": "Cache write",
			"bucket.output": "Output",
			"balance.title": "Account balance",
			"balance.remaining": "{percent}% remaining",
			"balance.consumed": "Spent this run",
			"balance.granted": "Granted",
			"balance.toppedUp": "Top-up",
			"balance.missingKey": "No API key configured (DEEPSEEK_API_KEY)",
			"balance.disabled": "Balance lookup is disabled",
			"balance.fetchFailed": "Balance lookup failed",
			"balance.http": "Balance lookup failed ({code})",
			"total.title": "Total spend",
			"total.sessions": "{n} sessions",
			"total.unavailable": "Total spend unavailable",
			"note": "Estimated at DeepSeek official prices; adjust prices in the profile config",
			"updated": "Updated {time}",
			"unknown": "unknown model"
		};
		const NS = "token-cost";
		//#endregion
		//#region helpers
		const POSITION_KEY = "dsh.token-cost.position";
		const INITIAL_BALANCE_KEY = "dsh.token-cost.initialBalance";
		const FAB_SIZE = 44;
		const MARGIN = 12;
		const EDGE_SNAP = 72;
		const PANEL_WIDTH = 316;
		const PANEL_EST_HEIGHT = 430;
		/** Ring geometry: 54px viewBox, 24px radius, 3px stroke. */
		const RING_RADIUS = 24;
		const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
		/** Hero ring geometry: 64px viewBox, 28px radius, 4px stroke. */
		const HERO_RING_RADIUS = 28;
		const HERO_RING_CIRCUMFERENCE = 2 * Math.PI * HERO_RING_RADIUS;
		/**
		 * Remaining-funds tone: the ratio of the current balance to the
		 * balance recorded when this DSH page was opened (resets upward on
		 * top-up). Good > 60%, amber 30-60%, red below.
		 */
		function remainingTone(ratio) {
			if (ratio === null) return { stroke: "#4d6bfe", glow: "#4d6bfe", kind: "good" };
			if (ratio < 0.3) return { stroke: "#ef4444", glow: "#ef4444", kind: "bad" };
			if (ratio < 0.6) return { stroke: "#f59e0b", glow: "#f59e0b", kind: "warn" };
			return { stroke: "#4d6bfe", glow: "#4d6bfe", kind: "good" };
		}
		/** Remaining ratio of the current balance against the session's initial balance; null until both are known. */
		function remainingRatioOf(current, initial) {
			if (typeof current !== "number" || !Number.isFinite(current) || current <= 0) return null;
			if (initial === null || typeof initial !== "number" || !Number.isFinite(initial) || initial <= 0) return null;
			return Math.min(1, Math.max(0, current / initial));
		}
		/** Read the remembered initial balance for this DSH session. */
		function readInitialBalance() {
			try {
				const raw = localStorage.getItem(INITIAL_BALANCE_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed.value === "number" && Number.isFinite(parsed.value)) return parsed.value;
				}
			} catch {
				// fall through to null
			}
			return null;
		}
		/** Persist the initial balance baseline. */
		function saveInitialBalance(value) {
			try {
				localStorage.setItem(INITIAL_BALANCE_KEY, JSON.stringify({ value, at: Date.now() }));
			} catch {
				// storage unavailable; the baseline just won't survive a reload
			}
		}
		/** Compact token count: 517 / 12.2K / 517K / 1.2M. */
		function formatTokens(n) {
			const scaled = (v) => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
			if (n < 1e3) return String(n);
			if (n < 1e6) return `${scaled(n / 1e3)}K`;
			return `${scaled(n / 1e6)}M`;
		}
		/** 4-decimal currency figure. */
		function formatCost(cost) {
			return cost.toFixed(4);
		}
		/** Currency symbol for a currency code. */
		function currencyOf(currency) {
			if (currency === "CNY") return "¥";
			if (currency === "USD") return "$";
			return `${currency} `;
		}
		/** Sum of the four disjoint buckets. */
		function totalTokensOf(tokens) {
			return tokens.uncachedInput + tokens.cacheRead + tokens.cacheWrite + tokens.output;
		}
		/** Read the remembered position (clamped); defaults to the bottom-right. */
		function readPosition() {
			try {
				const raw = localStorage.getItem(POSITION_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed.left === "number" && typeof parsed.top === "number") {
						return {
							left: Math.min(Math.max(parsed.left, MARGIN), Math.max(MARGIN, window.innerWidth - FAB_SIZE - MARGIN)),
							top: Math.min(Math.max(parsed.top, MARGIN), Math.max(MARGIN, window.innerHeight - FAB_SIZE - MARGIN))
						};
					}
				}
			} catch {
				// fall through to the default
			}
			return { right: MARGIN, bottom: MARGIN };
		}
		/** Persist a left/top position. */
		function savePosition(left, top) {
			try {
				localStorage.setItem(POSITION_KEY, JSON.stringify({ left, top }));
			} catch {
				// storage unavailable; the position just won't survive a reload
			}
		}
		/** One balance info row (CNY preferred). */
		function balanceInfoOf(value) {
			const infos = Array.isArray(value?.balance_infos) ? value.balance_infos : [];
			return infos.find((info) => info.currency === "CNY") ?? infos[0];
		}
		/** Poll one JSON endpoint; null until the first response lands. */
		function useJsonEndpoint(path, pollMs = 6e4) {
			const [state, setState] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				const load = () => {
					fetch(path, { cache: "no-store" }).then((res) => res.json()).then((body) => {
						if (alive) setState(body);
					}).catch(() => {
						if (alive) setState({ ok: false, code: "fetch-failed" });
					});
				};
				load();
				const timer = window.setInterval(load, pollMs);
				return () => {
					alive = false;
					window.clearInterval(timer);
				};
			}, [path, pollMs]);
			return state;
		}
		/** Shorten a long model id for display. */
		function shortModel(model) {
			if (model.length <= 24) return model;
			return `${model.slice(0, 12)}…${model.slice(-8)}`;
		}
		//#endregion
		//#region card pieces
		/**
		 * Gradient hero card: current balance, a ring showing the remaining
		 * share against the balance recorded when this DSH page opened, and
		 * this run's real spend (initial minus current).
		 */
		function HeroSection({ balance, t, initialBalance }) {
			if (balance === null) {
				return (0, react_jsx_runtime.jsx)("div", {
					className: styles.hero,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: styles.heroMain,
						children: [(0, react_jsx_runtime.jsx)("div", { className: styles.heroLabel, children: t("balance.title") }), (0, react_jsx_runtime.jsx)("div", { className: styles.heroBalance, children: "…" })]
					})]
				});
			}
			if (balance.ok && balance.value !== void 0) {
				const info = balanceInfoOf(balance.value);
				if (info === void 0) return null;
				const sym = currencyOf(info.currency);
				const current = Number(info.total_balance);
				const ratio = remainingRatioOf(current, initialBalance);
				const tone = remainingTone(ratio);
				const percent = ratio === null ? null : Math.round(ratio * 100);
				const consumed = ratio === null ? null : Math.max(0, initialBalance - current);
				const sub = [];
				if (consumed !== null) sub.push(`${t("balance.consumed")} ${sym}${consumed.toFixed(2)}`);
				if (Number(info.granted_balance) > 0) sub.push(`${t("balance.granted")} ${sym}${info.granted_balance}`);
				if (Number(info.topped_up_balance) > 0) sub.push(`${t("balance.toppedUp")} ${sym}${info.topped_up_balance}`);
				const heroOffset = HERO_RING_CIRCUMFERENCE * (1 - (ratio ?? 1));
				return (0, react_jsx_runtime.jsxs)("div", {
					className: styles.hero,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: styles.heroRing,
						children: [(0, react_jsx_runtime.jsx)("svg", {
							className: styles.heroRingSvg,
							viewBox: "0 0 64 64",
							"aria-hidden": true,
							children: [(0, react_jsx_runtime.jsx)("circle", { className: styles.heroRingTrack, cx: 32, cy: 32, r: HERO_RING_RADIUS }), (0, react_jsx_runtime.jsx)("circle", {
								className: styles.heroRingFill,
								cx: 32,
								cy: 32,
								r: HERO_RING_RADIUS,
								stroke: "#fff",
								strokeDasharray: HERO_RING_CIRCUMFERENCE,
								strokeDashoffset: heroOffset
							})]
						}), (0, react_jsx_runtime.jsx)("span", {
							className: styles.heroRingNum,
							children: percent === null ? "—" : `${percent}%`
						})]
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: styles.heroMain,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							style: { display: "flex", alignItems: "baseline", gap: 8 },
							children: [(0, react_jsx_runtime.jsx)("div", { className: styles.heroLabel, children: t("balance.title") }), percent !== null ? (0, react_jsx_runtime.jsx)("span", {
								className: styles.heroPill,
								children: t("balance.remaining", { percent })
							}) : null]
						}), (0, react_jsx_runtime.jsx)("span", {
							key: current,
							className: `${styles.heroBalance} ${styles.numPop}`,
							children: `${sym}${info.total_balance}`
						}), sub.length > 0 ? (0, react_jsx_runtime.jsx)("div", { className: styles.heroSub, children: sub.join(" · ") }) : null]
					})]
				});
			}
			const message = balance.code === "missing-key" ? t("balance.missingKey") : balance.code === "disabled" ? t("balance.disabled") : balance.code === "fetch-failed" ? t("balance.fetchFailed") : t("balance.http", { code: balance.code ?? "?" });
			return (0, react_jsx_runtime.jsxs)("div", {
				className: styles.hero,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: styles.heroMain,
					children: [(0, react_jsx_runtime.jsx)("div", { className: styles.heroLabel, children: t("balance.title") }), (0, react_jsx_runtime.jsx)("div", { className: styles.heroSub, children: message })]
				})]
			});
		}
		/** Session token usage: cost figure plus per-bucket chips. */
		function SessionSection({ proj, t }) {
			if (proj === void 0 || proj.tokens === void 0 || totalTokensOf(proj.tokens) <= 0) {
				return (0, react_jsx_runtime.jsxs)("div", {
					className: styles.section,
					children: [(0, react_jsx_runtime.jsx)("div", { className: styles.sectionLabel, children: t("session.label") }), (0, react_jsx_runtime.jsx)("div", { className: `${styles.sectionBody} ${styles.degraded}`, children: "—" })]
				});
			}
			const sym = currencyOf(proj.currency);
			const buckets = [
				{ key: "uncachedInput", label: t("bucket.input"), cls: styles.segInput },
				{ key: "cacheRead", label: t("bucket.cacheRead"), cls: styles.segRead },
				{ key: "cacheWrite", label: t("bucket.cacheWrite"), cls: styles.segWrite },
				{ key: "output", label: t("bucket.output"), cls: styles.segOutput }
			];
			const shown = buckets.filter((bucket) => proj.tokens[bucket.key] > 0);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: styles.section,
				children: [(0, react_jsx_runtime.jsx)("div", { className: styles.sectionLabel, children: t("session.label") }), (0, react_jsx_runtime.jsxs)("div", {
					className: styles.sectionBody,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: styles.row,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: styles.rowValue,
							children: `${sym}${formatCost(proj.cost)}`
						}), (0, react_jsx_runtime.jsx)("span", {
							className: styles.sub,
							children: formatTokens(totalTokensOf(proj.tokens))
						})]
					}), (0, react_jsx_runtime.jsx)("div", {
						className: styles.buckets,
						children: shown.map((bucket) => (0, react_jsx_runtime.jsxs)("span", {
							className: styles.chip,
							children: [(0, react_jsx_runtime.jsx)("span", { className: `${styles.swatch} ${bucket.cls}` }), (0, react_jsx_runtime.jsx)("span", { children: bucket.label }), (0, react_jsx_runtime.jsx)("span", {
								className: styles.chipNum,
								children: formatTokens(proj.tokens[bucket.key])
							})]
						}, bucket.key))
					})]
				})]
			});
		}
		/** Aggregated spend across sessions plus per-model split. */
		function TotalSection({ summary, t }) {
			if (summary === null || !summary.ok || summary.value === void 0) {
				return (0, react_jsx_runtime.jsxs)("div", {
					className: styles.section,
					children: [(0, react_jsx_runtime.jsx)("div", { className: styles.sectionLabel, children: t("total.title") }), (0, react_jsx_runtime.jsx)("div", { className: `${styles.sectionBody} ${styles.degraded}`, children: t("total.unavailable") })]
				});
			}
			const sym = currencyOf(summary.value.currency);
			const byModel = Object.entries(summary.value.byModel ?? {});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: styles.section,
				children: [(0, react_jsx_runtime.jsx)("div", { className: styles.sectionLabel, children: t("total.title") }), (0, react_jsx_runtime.jsxs)("div", {
					className: styles.sectionBody,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: styles.row,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: styles.rowValue,
							children: `${sym}${formatCost(summary.value.cost)}`
						}), (0, react_jsx_runtime.jsx)("span", {
							className: styles.sub,
							children: t("total.sessions", { n: summary.value.sessions })
						})]
					}), byModel.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
						className: styles.models,
						children: byModel.map(([model, entry]) => `${shortModel(model)} ${formatTokens(entry.tokens.uncachedInput + entry.tokens.cacheRead + entry.tokens.cacheWrite + entry.tokens.output)} ${sym}${formatCost(entry.cost)}`).join(" · ")
					}) : null]
				})]
			});
		}
		//#endregion
		//#region floating widget
		/**
		 * The Doubao/Youdao-style floating whale: click toggles the anchored
		 * card, drag moves the orb (with edge snapping) and carries the card
		 * along while it is open. Outside click / Escape / close button close
		 * the card. The whale's ring visualizes the remaining share of the
		 * balance recorded when this DSH page opened.
		 */
		function TokenCostWidget({ t, sessionsList }) {
			const [position, setPosition] = (0, react.useState)(readPosition);
			const [open, setOpen] = (0, react.useState)(false);
			const [dragging, setDragging] = (0, react.useState)(false);
			const [dim, setDim] = (0, react.useState)(false);
			const [initialBalance, setInitialBalance] = (0, react.useState)(readInitialBalance);
			const rootRef = (0, react.useRef)(null);
			const fabRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const drag = (0, react.useRef)(null);
			const [panelSize, setPanelSize] = (0, react.useState)(null);
			const balance = useJsonEndpoint("/api/token-cost/balance");
			const summary = useJsonEndpoint("/api/token-cost/summary");
			// Current session's tokenCost projection from the sessions list
			// store (projectionValues are the live client projection values).
			const subscribeSessions = (0, react.useCallback)((callback) => sessionsList.subscribe(callback), [sessionsList]);
			const readSessions = (0, react.useCallback)(() => sessionsList.getSnapshot(), [sessionsList]);
			const sessionsSnapshot = react.useSyncExternalStore(subscribeSessions, readSessions);
			const currentSessionId = sessionsSnapshot?.current;
			const currentTokenCost = currentSessionId === void 0 ? null : (sessionsSnapshot?.byId?.[currentSessionId]?.projectionValues?.tokenCost ?? null);

			// Maintain the session balance baseline: the first observed balance
			// becomes the initial amount; a top-up (current > baseline) lifts
			// the baseline so "remaining" resets to 100%.
			(0, react.useEffect)(() => {
				if (balance === null || !balance.ok || balance.value === void 0) return;
				const info = balanceInfoOf(balance.value);
				const current = Number(info?.total_balance);
				if (!Number.isFinite(current) || current <= 0) return;
				setInitialBalance((prev) => {
					if (prev === null || current > prev) {
						saveInitialBalance(current);
						return current;
					}
					return prev;
				});
			}, [balance]);

			// Close on outside pointerdown / Escape while the card is open.
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return;
					setOpen(false);
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);

			// Drag with click/drag discrimination: press without movement
			// toggles the card; movement drags the orb (and carries an open
			// card along). Left/right edge snapping on release.
			const onPointerDown = (event) => {
				if (event.button !== 0) return;
				const fab = fabRef.current;
				if (fab === null) return;
				event.preventDefault();
				const rect = fab.getBoundingClientRect();
				drag.current = {
					startX: event.clientX,
					startY: event.clientY,
					originLeft: rect.left,
					originTop: rect.top,
					moved: false,
					lastLeft: rect.left,
					lastTop: rect.top
				};
				setDragging(true);
				const onMove = (moveEvent) => {
					const d = drag.current;
					if (d === null) return;
					const dx = moveEvent.clientX - d.startX;
					const dy = moveEvent.clientY - d.startY;
					if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
					if (!d.moved) return;
					d.lastLeft = Math.min(Math.max(d.originLeft + dx, MARGIN), Math.max(MARGIN, window.innerWidth - FAB_SIZE - MARGIN));
					d.lastTop = Math.min(Math.max(d.originTop + dy, MARGIN), Math.max(MARGIN, window.innerHeight - FAB_SIZE - MARGIN));
					setPosition({ left: d.lastLeft, top: d.lastTop });
				};
				const onUp = () => {
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
					const d = drag.current;
					drag.current = null;
					setDragging(false);
					if (d === null) return;
					if (d.moved) {
						// Snap to the nearer left/right edge when released close to it.
						const snapped = { left: d.lastLeft, top: d.lastTop };
						if (d.lastLeft < EDGE_SNAP) snapped.left = MARGIN;
						else if (window.innerWidth - (d.lastLeft + FAB_SIZE) < EDGE_SNAP) snapped.left = window.innerWidth - FAB_SIZE - MARGIN;
						setPosition(snapped);
						savePosition(snapped.left, snapped.top);
					} else {
						// A click: toggle the card.
						setOpen((value) => !value);
					}
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
			};
			/** Fade the whale while no data is available yet. */
			(0, react.useEffect)(() => {
				const hasData = (balance !== null && balance.ok) || (summary !== null && summary.ok && summary.value?.cost > 0) || currentTokenCost !== null;
				setDim(!hasData);
			}, [balance, summary, currentTokenCost]);
			/** Measure the open card once it renders, for viewport clamping. */
			(0, react.useLayoutEffect)(() => {
				if (!open) {
					setPanelSize(null);
					return;
				}
				const el = panelRef.current;
				if (el === null) return;
				const size = { width: el.offsetWidth, height: el.offsetHeight };
				setPanelSize((prev) => prev !== null && prev.width === size.width && prev.height === size.height ? prev : size);
			}, [open]);
			// Show once any data channel has answered (even a degraded balance
			// or summary); before that the widget stays unmounted.
			const hasAnything = balance !== null || summary !== null || currentTokenCost !== null;
			if (!hasAnything) return null;

			// Remaining share of the balance against the session baseline,
			// shared by the whale ring and the hero card.
			const balanceTotal = balance !== null && balance.ok && balance.value !== void 0 ? Number(balanceInfoOf(balance.value)?.total_balance) : 0;
			const ratio = remainingRatioOf(balanceTotal, initialBalance);
			const ringAvail = ratio !== null;
			const ringOffset = RING_CIRCUMFERENCE * (1 - (ringAvail ? ratio : 1));
			const tone = remainingTone(ratio);

			// Anchor the card on the side with the most room (right > left >
			// down > up), then clamp the measured card position into the
			// viewport and point the arrow at the whale.
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const anchorLeft = position.left;
			const x = anchorLeft ?? vw - FAB_SIZE - MARGIN;
			const y = position.top ?? vh - FAB_SIZE - MARGIN;
			const expandRight = x + FAB_SIZE + 12 + PANEL_WIDTH <= vw;
			const expandLeft = x - 12 - PANEL_WIDTH >= 0;
			const expandDown = y + FAB_SIZE + 12 + PANEL_EST_HEIGHT <= vh;
			const side = expandRight ? "right" : expandLeft ? "left" : expandDown ? "down" : "up";
			const panelClass = side === "right" ? styles.panelRight : side === "left" ? styles.panelLeft : side === "down" ? styles.panelDown : styles.panelUp;
			let panelStyle = {};
			if (panelSize !== null) {
				if (side === "right" || side === "left") {
					const top = Math.min(Math.max(FAB_SIZE / 2 - panelSize.height / 2, MARGIN - y), vh - MARGIN - panelSize.height - y);
					panelStyle = { top, "--tc-arrow": `${Math.min(Math.max(FAB_SIZE / 2 - top, 14), panelSize.height - 14)}px`, transformOrigin: side === "right" ? "left center" : "right center" };
				} else {
					const left = Math.min(Math.max(FAB_SIZE / 2 - panelSize.width / 2, MARGIN - x), vw - MARGIN - panelSize.width - x);
					panelStyle = { left, "--tc-arrow": `${Math.min(Math.max(FAB_SIZE / 2 - left, 14), panelSize.width - 14)}px`, transformOrigin: side === "down" ? "top center" : "bottom center" };
				}
			}
			const widgetStyle = anchorLeft !== void 0 ? { left: anchorLeft, top: position.top } : { right: position.right, bottom: position.bottom };
			return (0, react_jsx_runtime.jsx)("div", {
				ref: rootRef,
				className: styles.widget,
				style: widgetStyle,
				children: [open && (0, react_jsx_runtime.jsx)("div", {
					ref: panelRef,
					className: `${styles.panel} ${panelClass}`,
					style: panelStyle,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: styles.panelHeader,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: styles.panelHeaderIcon,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size: 16 })
						}), (0, react_jsx_runtime.jsx)("span", { children: t("widget.title") }), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: styles.panelClose,
							"aria-label": t("widget.close"),
							onClick: () => {
								setOpen(false);
							},
							children: "✕"
						})]
					}), (0, react_jsx_runtime.jsx)(HeroSection, { balance, t, initialBalance }), (0, react_jsx_runtime.jsx)(SessionSection, { proj: currentTokenCost, t }), (0, react_jsx_runtime.jsx)(TotalSection, { summary, t }), (0, react_jsx_runtime.jsx)("div", { className: styles.note, children: t("note") })]
				}), (0, react_jsx_runtime.jsx)("span", {
					className: styles.fabWrap,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: styles.ring,
						style: { opacity: ringAvail ? 1 : 0.35, "--tc-glow": tone.glow },
						children: (0, react_jsx_runtime.jsx)("svg", {
							className: styles.ringSvg,
							width: FAB_SIZE + 10,
							height: FAB_SIZE + 10,
							viewBox: "0 0 54 54",
							"aria-hidden": true,
							children: [(0, react_jsx_runtime.jsx)("circle", { className: styles.ringTrack, cx: 27, cy: 27, r: RING_RADIUS }), (0, react_jsx_runtime.jsx)("circle", {
								className: styles.ringFill,
								cx: 27,
								cy: 27,
								r: RING_RADIUS,
								style: {
									stroke: tone.stroke,
									strokeDasharray: RING_CIRCUMFERENCE,
									strokeDashoffset: ringOffset
								}
							})]
						})
					}), (0, react_jsx_runtime.jsx)("button", {
						ref: fabRef,
						type: "button",
						className: `${styles.fab}${dragging ? ` ${styles.fabDragging}` : ""}${dim ? ` ${styles.fabDim}` : ""}`,
						"aria-label": t("widget.aria"),
						title: ringAvail ? t("balance.remaining", { percent: Math.round(ratio * 100) }) : void 0,
						onPointerDown: onPointerDown,
						children: (0, react_jsx_runtime.jsx)("span", {
							className: styles.fish,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size: 26 })
						})
					})]
				})]
			});
		}
		//#endregion
		//#region plugin
		/** Services required by this plugin. */
		const inject = [
			"locale",
			"sessions"
		];
		/** Mount the floating widget and the dictionaries. */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			const sessionsList = ctx.sessions.list;
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "token-cost: dictionaries");
			ctx.effect(() => {
				const host = document.createElement("div");
				host.dataset.dshTokenCost = "";
				document.body.appendChild(host);
				const root = react_dom_client.createRoot(host);
				root.render((0, react_jsx_runtime.jsx)(TokenCostWidget, { t, sessionsList }));
				return () => {
					root.unmount();
					host.remove();
				};
			}, "token-cost: floating widget");
		}
		//#endregion
		exports.TokenCostWidget = TokenCostWidget;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
