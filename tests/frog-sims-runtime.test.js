const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
test('Sims: des cadeaux groupés, fragmentés ou refusés ne perdent pas les suivants',()=>{const r=spawnSync('python',['tests/sims4_runtime_test.py'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr||r.error?.message);});

test('Frog et Sims ignorent les anciens ports enregistrés et transmettent les cadeaux au module', async t => {
  const net = require('node:net');
  const { GameHub } = require('../src/main/game-hub');
  const { OWNER_INTEGRATIONS } = require('../src/main/game-catalog/owner-integrations');
  const { authenticatedFixtureStore } = require('./helpers/authenticated-store');
  for (const [id, code] of [['frog-sqwad', 'speed_up'], ['the-sims-4', 'addviewer']]) {
    const pack = structuredClone(OWNER_INTEGRATIONS.find(p => p.id === id));
    pack.ownerOnly = false;
    pack.connector.port = 0;
    const state = { session: { activeGamePackId: id }, commerce: { subscription: { tier: 'pro', source: 'subscription', status: 'active' }, gameEntitlements: [] }, game: { connectorOverrides: { [id]: { port: 1, host: '203.0.113.1' } } }, rules: [] };
    const store = authenticatedFixtureStore({ getState: () => state, mutate: callback => callback(state) });
    const resourcesDirectory = path.resolve(__dirname, '../resources');
    const hub = new GameHub({ store, resourcesDirectory, packsDirectory: path.join(resourcesDirectory, 'packs') });
    hub.packs = [pack];
    const address = await hub.prepareConnection(id);
    const frames = [];
    const client = net.createConnection({ host: '127.0.0.1', port: address.port });
    t.after(async () => { client.destroy(); await hub.disconnectAll(); });
    await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('error', reject); });
    let buffer = '';
    client.on('data', chunk => {
      buffer += chunk.toString(); let end;
      while ((end = buffer.indexOf('\0')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); frames.push(frame);
        client.write(JSON.stringify({ id: frame.id, status: 0 }) + '\0');
      }
    });
    const effect = pack.effects.find(e => e.code === code);
    await hub.trigger(effect.id, { source: 'gift', user: { id: 'viewer-test', displayName: 'Léa' } }, { packId: id });
    assert.equal(frames.length, 1);
    assert.equal(frames[0].code, code);
    assert.equal(frames[0].viewer, 'Léa');
    assert.equal(frames[0].duration, (effect.duration || 0) * 1000);
  }
});
