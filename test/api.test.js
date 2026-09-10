const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { getHomeMode, HOME_MODE } = require('../js/homeState');
const app = require('../backend/server');

let server;
let baseUrl;

test.before(async () => {
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const body = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(body);
    } catch {
        parsed = body;
    }
    return { response, body: parsed };
}

test('database health is available', async () => {
    const { response, body } = await request('/api/health/database');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok', database: 'postgresql' });
});

test('curated restaurants are served from the database', async () => {
    const { response, body } = await request('/api/restaurants');
    assert.equal(response.status, 200);
    assert.equal(body.length, 24);
});

test('restaurant filtering and detail lookup work', async () => {
    const filtered = await request('/api/restaurants?category=Bakery&search=Salman');
    assert.equal(filtered.response.status, 200);
    assert.equal(filtered.body.length, 3);
    assert.equal(filtered.body[0].category, 'Bakery');

    const detail = await request('/api/restaurants/1');
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.name, 'Salman Baker');
});

test('empty restaurant searches return an empty array', async () => {
    const { response, body } = await request('/api/restaurants?search=does-not-exist');
    assert.equal(response.status, 200);
    assert.deepEqual(body, []);
});

test('provider validation and coordinate validation are explicit', async () => {
    const unsupported = await request('/api/restaurants/search?provider=unknown&near=Peshawar');
    assert.equal(unsupported.response.status, 400);
    assert.equal(unsupported.body.provider, 'unknown');

    const invalidCoordinates = await request('/api/restaurants/search?provider=osm&ll=invalid');
    assert.equal(invalidCoordinates.response.status, 400);
    assert.match(invalidCoordinates.body.error, /Invalid "ll" value/);
});

test('feedback rejects invalid payloads without writing data', async () => {
    const payload = JSON.stringify({ type: 'Invalid', message: '' });
    const { response, body } = await request('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
    });
    assert.equal(response.status, 400);
    assert.match(body.error, /valid feedback type/);
});

test('feedback listing is protected when no admin token is configured', async () => {
    const { response, body } = await request('/api/feedback');
    assert.equal(response.status, 503);
    assert.match(body.error, /not configured/);
});

test('sensitive files remain inaccessible through the browser', async () => {
    const envFile = await request('/.env');
    const packageFile = await request('/package.json');
    assert.equal(envFile.response.status, 404);
    assert.equal(packageFile.response.status, 404);
});

test('feedback admin route accepts a configured header token', async () => {
    const originalToken = process.env.FEEDBACK_ADMIN_TOKEN;
    process.env.FEEDBACK_ADMIN_TOKEN = 'test-admin-token';
    delete require.cache[require.resolve('../backend/server')];
    const freshApp = require('../backend/server');
    const localServer = freshApp.listen(0);
    await new Promise(resolve => localServer.once('listening', resolve));
    const base = `http://127.0.0.1:${localServer.address().port}`;

    try {
        const { response, body } = await fetch(`${base}/api/feedback`, {
            headers: { 'x-admin-token': 'test-admin-token' }
        }).then(async res => {
            const text = await res.text();
            let parsed;
            try { parsed = JSON.parse(text); } catch { parsed = text; }
            return { response: res, body: parsed };
        });

        assert.equal(response.status, 200);
        assert.ok(Array.isArray(body));
    } finally {
        await new Promise((resolve, reject) => localServer.close(error => error ? reject(error) : resolve()));
        delete require.cache[require.resolve('../backend/server')];
        if (originalToken === undefined) {
            delete process.env.FEEDBACK_ADMIN_TOKEN;
        } else {
            process.env.FEEDBACK_ADMIN_TOKEN = originalToken;
        }
    }
});

test('homepage content mode distinguishes normal home, hybrid Peshawar, and non-Peshawar live search', () => {
    assert.equal(getHomeMode({ selectedLocation: '', isSearchActive: false }), HOME_MODE.NORMAL);
    assert.equal(getHomeMode({ selectedLocation: 'Lahore', isSearchActive: false }), HOME_MODE.NORMAL);
    assert.equal(getHomeMode({ selectedLocation: 'Lahore', isSearchActive: true }), HOME_MODE.LIVE_SEARCH);
    assert.equal(getHomeMode({ selectedLocation: 'Peshawar', isSearchActive: true }), HOME_MODE.PESHAWAR_HYBRID);
    assert.equal(getHomeMode({ selectedLocation: 'Peshawar', isSearchActive: false }), HOME_MODE.NORMAL);
});
