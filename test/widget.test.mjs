/**
 * Regression tests for the browser half's floating widget.
 *
 * The desktop bug these cover: the card only mounts on click, `SessionSection`
 * read `.tokens` off a `null` projection, and the resulting render error made
 * React unmount the whole root — so clicking the whale made the widget vanish.
 *
 * The card is rendered with the real React server renderer (correct error
 * boundary semantics) while the hook surface is faked just enough to place the
 * component in the post-click state and hand it endpoint payloads. React and
 * react-dom are resolved from a DSH profile, where they already live:
 *
 *   DSH_HOME=<home> node --test test/widget.test.mjs
 *
 * Environment:
 *   DSH_HOME               profile home; react is read from <home>/profiles/node_modules
 *   DSH_TOKEN_COST_MODULES override the node_modules directory holding react
 *   DSH_TOKEN_COST_CLIENT  test a different copy of the browser half (A/B checks)
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Writable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
// Mirror the shipped frontend: it runs a production React build, so dev-only
// diagnostics (for example the key warnings the hand-written bundle would
// otherwise emit for its static sibling arrays) stay out of the way here too.
process.env.NODE_ENV ??= 'production'
const CLIENT_PATH = process.env.DSH_TOKEN_COST_CLIENT ?? path.join(REPO_ROOT, 'lib', 'client.js')
const MODULES_DIR = process.env.DSH_TOKEN_COST_MODULES
	?? (process.env.DSH_HOME === undefined ? null : path.join(process.env.DSH_HOME, 'profiles', 'node_modules'))

if (MODULES_DIR === null || !(await import('node:fs')).existsSync(path.join(MODULES_DIR, 'react', 'package.json'))) {
	throw new Error(`react/react-dom not found under ${MODULES_DIR ?? '(no DSH_HOME set)'} — set DSH_HOME or DSH_TOKEN_COST_MODULES`)
}

const requireFromHarness = createRequire(path.join(MODULES_DIR, 'noop.js'))
const React = requireFromHarness('react')
// The streaming server renderer is the one that honours error boundaries — the
// legacy synchronous one rethrows a subtree failure instead of rendering the
// fence's fallback, which is exactly the behaviour under test here.
const { renderToPipeableStream } = requireFromHarness('react-dom/server')
const jsxRuntime = requireFromHarness('react/jsx-runtime')

/** Render one element to HTML, letting error boundaries recover. */
function renderToHtml(element) {
	return new Promise((resolve, reject) => {
		let html = ''
		const sink = new Writable({
			write(chunk, _encoding, callback) {
				html += chunk
				callback()
			}
		})
		sink.on('finish', () => resolve(html))
		sink.on('error', reject)
		const stream = renderToPipeableStream(element, {
			onError: () => {},
			onShellError: reject,
			onAllReady() {
				stream.pipe(sink)
			}
		})
	})
}

/** Deterministic catalogue so assertions can look for marker strings. */
const t = (key, params) => (params === undefined ? `«${key}»` : `«${key}:${JSON.stringify(params)}»`)

/** The fixed hook call order of `TokenCostWidget`; see `queueCursor` below. */
const SLOT = {
	position: 0,
	open: 1,
	dragging: 2,
	dim: 3,
	initialBalance: 4,
	panelSize: 5,
	balance: 6,
	summary: 7,
	session: 8
}

/** Fake hook state for one render pass: values are handed out by call order. */
let queue = []
let queueCursor = 0

async function loadPlugin() {
	let entry = null
	globalThis.window = {
		__ModuleLoader__: { load: (candidate) => { entry = candidate } },
		innerWidth: 1280,
		innerHeight: 800,
		addEventListener() {},
		removeEventListener() {},
		setInterval: () => 0,
		clearInterval() {},
		setTimeout: () => 0,
		clearTimeout() {}
	}
	globalThis.document = {
		addEventListener() {},
		removeEventListener() {},
		querySelector: () => null,
		createElement: () => ({ dataset: {}, appendChild() {}, remove() {} }),
		head: { appendChild() {} },
		body: { appendChild() {} }
	}
	globalThis.localStorage = { getItem: () => null, setItem() {} }
	const react = {
		...React,
		useState: (init) => {
			const queued = queue[queueCursor++]
			return [queued === undefined ? init : queued, () => {}]
		},
		useCallback: (fn) => fn,
		useMemo: (fn) => fn(),
		useLayoutEffect: () => {},
		useEffect: () => {},
		// SSR requires a third argument; the widget reads a plain store.
		useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot()
	}
	const require = (id) => {
		if (id === 'react') return react
		if (id === 'react/jsx-runtime') return jsxRuntime
		if (id === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) }
		if (id === '@deepseek-ai/dsh-client-ui-primitives') return { FishLogo: () => null }
		throw new Error(`unexpected require('${id}')`)
	}
	// Fresh module instance per case: the bundle registers itself on import.
	// (A `.js` target outside a `"type": "module"` package is loaded as CJS,
	// where Node ignores the cache-busting query and reuses the first instance.)
	await import(`${pathToFileURL(CLIENT_PATH).href}?case=${Math.random()}`)
	assert.ok(entry !== null, 'the bundle did not call window.__ModuleLoader__.load (already-cached CJS copy?)')
	return { entry, require }
}

/** Render the widget in the post-click state with the supplied payloads. */
async function renderWidget({ balance = null, summary = null, session = null, sessionRecord = null } = {}) {
	const { entry, require } = await loadPlugin()
	const exported = entry.factory(require)
	const sessionsList = {
		subscribe: () => () => {},
		getSnapshot: () => ({
			current: 'session-test',
			byId: { 'session-test': sessionRecord ?? { id: 'session-test' } }
		})
	}
	queue = []
	queue[SLOT.position] = { left: 900, top: 600 }
	queue[SLOT.open] = true
	queue[SLOT.dragging] = false
	queue[SLOT.dim] = false
	queue[SLOT.initialBalance] = 100
	queue[SLOT.panelSize] = null
	queue[SLOT.balance] = balance
	queue[SLOT.summary] = summary
	queue[SLOT.session] = session
	queueCursor = 0
	return renderToHtml(jsxRuntime.jsx(exported.TokenCostWidget, { t, sessionsList }))
}

const PROJ = {
	currency: 'CNY',
	cost: 0.6835,
	tokens: { uncachedInput: 56435, output: 36510, cacheRead: 1924608, cacheWrite: 0 },
	models: ['deepseek-v4-flash'],
	byModel: { 'deepseek-v4-flash': { cost: 0.6835, tokens: { uncachedInput: 56435, output: 36510, cacheRead: 1924608, cacheWrite: 0 } } }
}
const BALANCE = { ok: true, fetchedAt: 0, value: { balance_infos: [{ currency: 'CNY', total_balance: '42.50', granted_balance: '0', topped_up_balance: '42.50' }] } }
const SUMMARY = { currency: 'CNY', cost: 1.2345, sessions: 3, tokens: { uncachedInput: 1, output: 2, cacheRead: 3, cacheWrite: 0 }, byModel: { 'deepseek-v4-flash': { cost: 1.2345, tokens: { uncachedInput: 1, output: 2, cacheRead: 3, cacheWrite: 4 } } } }

test('the card renders when the session has no projection yet (click-to-open crash)', async () => {
	const html = await renderWidget({ balance: BALANCE, summary: SUMMARY, session: { ok: true, sessionId: 'session-test', value: null } })
	assert.match(html, /«session\.label»/, 'the session section should be present')
	assert.match(html, /—/, 'a missing projection degrades to a dash')
	assert.match(html, /«widget\.aria»/, 'the whale itself must survive')
	assert.doesNotMatch(html, /🐳/, 'the outer fence should not have been needed')
})

test('the host payloads are rendered as figures', async () => {
	const html = await renderWidget({ balance: BALANCE, summary: SUMMARY, session: { ok: true, sessionId: 'session-test', value: PROJ } })
	assert.match(html, /¥0\.6835/, 'this session’s cost')
	assert.match(html, /¥1\.2345/, 'the aggregate cost is read flat, not through an ok/value envelope')
	assert.match(html, /¥42\.5/, 'the account balance')
	assert.match(html, /deepseek-v4-flash/)
})

test('the rc.6 client store shape is read as the fallback source', async () => {
	const sessionRecord = {
		id: 'session-test',
		projections: { faceOf: (key) => ({ getSnapshot: () => (key === 'tokenCost' ? PROJ : null) }) }
	}
	const html = await renderWidget({ balance: BALANCE, summary: SUMMARY, session: { ok: true, sessionId: 'session-test', value: null }, sessionRecord })
	assert.match(html, /¥0\.6835/, 'projections.faceOf("tokenCost") supplies the figure')
})

test('the fence renders its fallback once a render error is recorded', async () => {
	// React's server renderers rethrow subtree failures instead of recovering,
	// so the fence is checked against the contract React itself uses: the error
	// is recorded through getDerivedStateFromError, then render() must produce
	// the fallback instead of the children.
	const { entry, require } = await loadPlugin()
	const exported = entry.factory(require)
	const fence = new exported.WidgetBoundary({ fallback: (error) => `FALLBACK:${error.message}`, children: 'CHILDREN' })
	assert.equal(fence.render(), 'CHILDREN', 'a healthy fence renders its children')
	fence.state = exported.WidgetBoundary.getDerivedStateFromError(new Error('boom'))
	assert.equal(fence.render(), 'FALLBACK:boom', 'a crashed fence renders the fallback, so the region degrades instead of vanishing')
})

test('both the card body and the widget root are fenced', async () => {
	// The crash came from a card section, so the deck must sit inside a fence;
	// the outer fence must wrap the widget itself so nothing can unmount the whale.
	const source = await (await import('node:fs/promises')).readFile(CLIENT_PATH, 'utf8')
	const panelFence = source.indexOf('react_jsx_runtime.jsx)(WidgetBoundary')
	assert.ok(panelFence > 0, 'the card body is wrapped in the fence')
	assert.ok(
		source.slice(panelFence).includes('jsx)(HeroSection') && source.slice(panelFence).includes('jsx)(SessionSection') && source.slice(panelFence).includes('jsx)(TotalSection'),
		'the fenced card body covers the hero, session and total sections'
	)
	const rootFence = source.indexOf('root.render((0, react_jsx_runtime.jsx)(WidgetBoundary')
	assert.ok(rootFence > 0, 'the widget root is wrapped in the fence too')
})
