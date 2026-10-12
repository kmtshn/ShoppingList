const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function openApp(seed) {
    const dom = new JSDOM(html, { url: 'https://example.com/ShoppingList/', runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;
    window.matchMedia = () => ({ matches: false });
    window.confirm = () => true;
    if (seed) window.localStorage.setItem('shoppingListData', JSON.stringify(seed));
    const copied = [];
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async text => copied.push(text) } });
    window.eval(script);
    window.dispatchEvent(new window.Event('DOMContentLoaded'));
    const get = id => window.document.getElementById(id);
    const click = id => get(id).click();
    const fill = (id, value) => { get(id).value = value; get(id).dispatchEvent(new window.Event('input')); };
    const check = id => { get(id).checked = !get(id).checked; get(id).dispatchEvent(new window.Event('change')); };
    const saved = () => JSON.parse(window.localStorage.getItem('shoppingListData'));
    return { dom, window, copied, get, click, fill, check, saved };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('bulk copy preserves memo formatting; empty controls are disabled', async () => {
    const app = openApp();
    assert.equal(app.get('copy-all-btn').disabled, true);
    assert.equal(app.get('share-purchased-btn').disabled, true);
    const memo = 'たまご\n\n 牛乳 \nパン';
    app.fill('memo-input', memo);
    app.click('copy-all-btn');
    await settle();
    assert.deepEqual(app.copied, [memo]);
    assert.match(app.get('action-status').textContent, /コピーしました/);
    app.dom.window.close();
});

test('hidden purchases are shared and copied; check state survives reload and memo edits', async () => {
    let app = openApp();
    app.fill('memo-input', 'たまご\n牛乳\nたまご\nパン');
    app.click('switch-to-checklist-btn');
    app.check('checklist-item-2');
    app.check('hide-completed-toggle');
    assert.equal(app.window.document.querySelector('.completed-item').classList.contains('hidden'), true);
    app.click('share-purchased-btn');
    await settle();
    app.click('copy-all-btn');
    await settle();
    assert.deepEqual(app.copied, ['買い物リストの購入済み（1件）\n・たまご', 'たまご\n牛乳\nたまご\nパン']);
    const saved = app.saved();
    app.dom.window.close();
    app = openApp(saved);
    assert.equal(app.get('share-purchased-btn').textContent, '購入済みを共有（1件）');
    app.fill('memo-input', '牛乳\nたまご\nたまご\nパン\nバナナ');
    app.click('switch-to-checklist-btn');
    assert.equal(app.get('checklist-item-1').checked, false);
    assert.equal(app.get('checklist-item-2').checked, true);
    app.click('switch-to-memo-btn');
    app.click('switch-to-checklist-btn');
    assert.equal(app.get('checklist-item-2').checked, true);
    app.dom.window.close();
});

test('native share receives purchases only; cancellation does not copy', async () => {
    const app = openApp();
    app.fill('memo-input', '牛乳\nパン');
    app.click('switch-to-checklist-btn');
    app.check('checklist-item-0');
    let shared;
    app.window.navigator.share = async data => { shared = JSON.parse(JSON.stringify(data)); };
    app.click('share-purchased-btn');
    await settle();
    assert.deepEqual(shared, { title: '買い物リストの購入済み', text: '買い物リストの購入済み（1件）\n・牛乳' });
    app.window.navigator.share = async () => { throw new app.window.DOMException('Cancelled', 'AbortError'); };
    app.click('share-purchased-btn');
    await settle();
    assert.deepEqual(app.copied, []);
    assert.equal(app.get('action-status').textContent, '');
    app.dom.window.close();
});

test('native share denial falls back to clipboard', async () => {
    const app = openApp();
    app.fill('memo-input', 'パン');
    app.click('switch-to-checklist-btn');
    app.check('checklist-item-0');
    app.window.navigator.share = async () => { throw new app.window.DOMException('Denied', 'NotAllowedError'); };
    app.click('share-purchased-btn');
    await settle();
    assert.deepEqual(app.copied, ['買い物リストの購入済み（1件）\n・パン']);
    app.dom.window.close();
});

test('legacy clipboard fallback copies selected text, restores focus and reports errors', async () => {
    const app = openApp();
    app.fill('memo-input', '牛乳\nパン');
    app.window.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
    let selected;
    app.window.document.execCommand = command => { selected = app.window.document.activeElement.value; return command === 'copy'; };
    app.get('copy-all-btn').focus();
    app.click('copy-all-btn');
    await settle();
    assert.equal(selected, '牛乳\nパン');
    assert.equal(app.window.document.activeElement.id, 'copy-all-btn');
    assert.equal(app.window.document.querySelectorAll('textarea').length, 1);
    app.window.document.execCommand = () => false;
    app.click('copy-all-btn');
    await settle();
    assert.match(app.get('action-status').textContent, /コピーできませんでした/);
    app.click('switch-to-checklist-btn');
    app.check('checklist-item-0');
    app.click('share-purchased-btn');
    await settle();
    assert.match(app.get('action-status').textContent, /共有できませんでした/);
    app.dom.window.close();
});

test('old saved lists migrate; empty tab switches cannot share another list purchases', async () => {
    const app = openApp({ settings: { multiListEnabled: true, hideCompleted: false }, activeListId: 'first', lists: [{ id: 'first', name: '食品', content: '牛乳' }, { id: 'second', name: '日用品', content: '' }] });
    app.click('switch-to-checklist-btn');
    app.check('checklist-item-0');
    const tab = id => app.window.document.querySelector(`.tab-item[data-list-id="${id}"]`);
    tab('second').click();
    assert.equal(app.window.document.querySelectorAll('.checklist-item').length, 0);
    assert.equal(app.get('copy-all-btn').disabled, true);
    assert.equal(app.get('share-purchased-btn').disabled, true);
    app.fill('add-item-input', '洗剤');
    app.click('add-item-btn');
    app.check('checklist-item-0');
    app.click('share-purchased-btn');
    await settle();
    assert.deepEqual(app.copied, ['日用品の購入済み（1件）\n・洗剤']);
    tab('first').click();
    assert.equal(app.get('checklist-item-0').checked, true);
    app.click('share-purchased-btn');
    await settle();
    assert.equal(app.copied.at(-1), '食品の購入済み（1件）\n・牛乳');
    app.dom.window.close();
});

test('clearing purchases from memo view and clearing memo cannot resurrect stale rows', () => {
    const app = openApp();
    app.fill('memo-input', '牛乳\nパン');
    app.click('switch-to-checklist-btn');
    app.check('checklist-item-0');
    app.click('switch-to-memo-btn');
    app.click('clear-checked-btn');
    assert.equal(app.get('memo-input').value, 'パン');
    assert.equal(app.get('share-purchased-btn').disabled, true);
    app.click('clear-memo-btn');
    app.click('clear-checked-btn');
    assert.equal(app.get('memo-input').value, '');
    assert.equal(app.get('copy-all-btn').disabled, true);
    app.dom.window.close();
});

test('service worker precaches only existing files; old cache cleanup preserves unrelated apps', async () => {
    const events = {}, cached = [], deleted = [];
    let skipped = false, claimed = false;
    const context = {
        self: { addEventListener: (name, handler) => { events[name] = handler; }, skipWaiting: async () => { skipped = true; }, clients: { claim: async () => { claimed = true; } } },
        caches: { open: async () => ({ addAll: async urls => { for (const url of urls) { assert.ok(fs.existsSync(path.join(root, url === './' ? 'index.html' : url)), url); cached.push(url); } } }), keys: async () => ['memoris-cache-v3', 'memoris-cache-v4', 'another-app-cache'], delete: async name => { deleted.push(name); } },
        console: { log() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8'), context);
    let pending;
    events.install({ waitUntil: promise => { pending = promise; } });
    await pending;
    for (const file of ['./app.js', './index.html', './icon-512.svg', './icon-192.png', './icon-512.png', './manifest.json']) assert.ok(cached.includes(file), file);
    assert.equal(skipped, true);
    events.activate({ waitUntil: promise => { pending = promise; } });
    await pending;
    assert.deepEqual(deleted, ['memoris-cache-v3']);
    assert.equal(claimed, true);
    const offlineResponse = { text: async () => script };
    context.caches.match = async () => offlineResponse;
    context.fetch = () => { throw new Error('Offline'); };
    events.fetch({ request: { method: 'GET' }, respondWith: promise => { pending = promise; } });
    assert.equal(await pending, offlineResponse);
    events.fetch({ request: { method: 'POST' }, respondWith: () => assert.fail('POST must not be cached') });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)));
});
