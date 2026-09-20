/**
 * Tests for the node half: the `tokenCost` projection unit registration and the
 * `/api/token-cost/*` routes, exercised through a stubbed cordis context so the
 * host contract can be checked without booting DSH.
 *
 * The host half imports nothing, so it loads standalone:
 *
 *   DSH_HOME=<home> node --test
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apply } from '../lib/index.js'

const PROJ = {
	currency: 'CNY',
	cost: 0.6835,
	tokens: { uncachedInput: 56435, output: 36510, cacheRead: 1924608, cacheWrite: 0 },
	models: ['deepseek-v4-flash'],
	byModel: { 'deepseek-v4-flash': { cost: 0.6835, tokens: { uncachedInput: 56435, output: 36510, cacheRead: 1924608, cacheWrite: 0 } } }
}

/** A host session stub carrying its projection value. */
const session = (id, tokenCost) => ({ id, tokenCost })

/** One consistent projection value (top level and per-model agree). */
const projOf = (cost, tokens) => ({
	currency: 'CNY',
	cost,
	tokens,
	models: ['deepseek-v4-flash'],
	byModel: { 'deepseek-v4-flash': { cost, tokens } }
})

/** Mount the plugin against a stubbed context; returns the registered pieces. */
function mount(services) {
	const registered = { projection: null, route: null }
	const context = {
		credentials: { resolve: async () => void 0 },
		webServer: {
			register: (route) => {
				registered.route = route
				return () => {}
			}
		},
		sessionProjections: {
			register: (definition) => {
				registered.projection = definition
				return () => {}
			},
			snapshot: (target) => (target.tokenCost === void 0 ? { values: {} } : { values: { tokenCost: target.tokenCost } })
		},
		sessionProjectionCache: {
			cachedSnapshot: (meta) => (meta.tokenCost === void 0 ? { values: {} } : { values: { tokenCost: meta.tokenCost } })
		},
		...services
	}
	const inject = (names, callback) => {
		const faces = {
			effect: (body) => {
				body()
				return () => {}
			},
			get: (name) => context[name]
		}
		for (const name of names) faces[name] = context[name]
		callback(faces)
	}
	apply({ get: (name) => context[name], inject }, {})
	return registered
}

/** One request against a registered route. */
async function request(route, url) {
	const captured = { status: null, headers: null, body: null }
	const res = {
		writeHead(status, headers) {
			captured.status = status
			captured.headers = headers
		},
		end(chunk) {
			captured.body = typeof chunk === 'string' ? JSON.parse(chunk) : null
		},
		destroy() {
			captured.destroyed = true
		}
	}
	await route.handler({ url }, res)
	return captured
}

test('the plugin registers one projection unit and one route prefix', () => {
	const { projection, route } = mount({})
	assert.equal(projection.key, 'tokenCost', 'the projection is published under the key the browser half reads')
	assert.equal(projection.stateVersion, 1)
	assert.equal(typeof projection.init, 'function')
	assert.equal(typeof projection.apply, 'function')
	assert.equal(typeof projection.view, 'function')
	assert.equal(route.kind, 'prefix')
	assert.equal(route.path, '/api/token-cost')
})

test('the session route answers with the live fold for a resident session', async () => {
	const { route } = mount({ sessions: { get: (id) => (id === 'live' ? session('live', PROJ) : void 0), list: () => [] } })
	const reply = await request(route, '/api/token-cost/session?id=live')
	assert.equal(reply.status, 200)
	assert.equal(reply.headers['cache-control'], 'no-store')
	assert.deepEqual(reply.body, { ok: true, sessionId: 'live', value: PROJ })
})

test('the session route falls back to the persisted projection cache', async () => {
	const { route } = mount({
		sessions: { get: () => void 0, list: () => [] },
		sessionPersistence: { list: async () => [session('cold', PROJ), session('other', void 0)] }
	})
	const reply = await request(route, '/api/token-cost/session?id=cold')
	assert.deepEqual(reply.body, { ok: true, sessionId: 'cold', value: PROJ })
})

test('the session route reports null for an unfolded session', async () => {
	const { route } = mount({ sessions: { get: () => void 0, list: () => [] } })
	const reply = await request(route, '/api/token-cost/session?id=missing')
	assert.equal(reply.status, 200)
	assert.deepEqual(reply.body, { ok: true, sessionId: 'missing', value: null })
})

test('the summary route aggregates every visible session, flat', async () => {
	const a = projOf(0.25, { uncachedInput: 10, output: 1, cacheRead: 2, cacheWrite: 0 })
	const b = projOf(0.75, { uncachedInput: 20, output: 2, cacheRead: 4, cacheWrite: 0 })
	const { route } = mount({ sessions: { get: () => void 0, list: () => [session('a', a), session('b', b)] } })
	const reply = await request(route, '/api/token-cost/summary')
	assert.equal(reply.status, 200)
	// The browser half reads this payload flat (no ok/value envelope).
	assert.equal(reply.body.ok, void 0)
	assert.equal(reply.body.currency, 'CNY')
	assert.equal(reply.body.cost, 1)
	assert.equal(reply.body.sessions, 2)
	assert.equal(reply.body.tokens.uncachedInput, 30)
	assert.equal(reply.body.tokens.output, 3)
	assert.equal(reply.body.byModel['deepseek-v4-flash'].cost, 1)
	assert.equal(reply.body.byModel['deepseek-v4-flash'].tokens.uncachedInput, 30)
})

test('the balance route wraps its body in an ok/value envelope', async () => {
	const original = globalThis.fetch
	globalThis.fetch = async () => ({
		ok: true,
		json: async () => ({ balance_infos: [{ currency: 'CNY', total_balance: '42.50' }] })
	})
	try {
		const { route } = mount({ credentials: { resolve: async () => ({ value: 'sk-test' }) } })
		const reply = await request(route, '/api/token-cost/balance')
		assert.equal(reply.body.ok, true)
		assert.equal(reply.body.value.balance_infos[0].total_balance, '42.50')
	} finally {
		globalThis.fetch = original
	}
})

test('an unknown route answers 404 instead of hanging the socket', async () => {
	const { route } = mount({})
	const reply = await request(route, '/api/token-cost/nope')
	assert.equal(reply.status, 404)
	assert.deepEqual(reply.body, { ok: false, code: 'not-found' })
})
