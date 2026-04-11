// tests/storage.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock chrome.storage before importing module
const localStore = {};
const sessionStore = {};

globalThis.chrome = {
  storage: {
    local: {
      get: async (key) => {
        const keys = Array.isArray(key) ? key : [key];
        return Object.fromEntries(keys.map(k => [k, localStore[k]]));
      },
      set: async (obj) => { Object.assign(localStore, obj); },
    },
    session: {
      get: async (key) => {
        const keys = Array.isArray(key) ? key : [key];
        return Object.fromEntries(keys.map(k => [k, sessionStore[k]]));
      },
      set: async (obj) => { Object.assign(sessionStore, obj); },
    },
  },
};

const { getProfile, saveProfile, getLogs, addLog, updateLogStatus, deleteLog, getRegisterCache, setRegisterCache } = await import('../shared/storage.js');

test('getProfile returns default profile when nothing stored', async () => {
  const profile = await getProfile();
  assert.ok(profile.personal);
  assert.equal(profile.personal.name, '');
  assert.ok(Array.isArray(profile.skills));
});

test('saveProfile and getProfile round-trip', async () => {
  const profile = await getProfile();
  profile.personal.name = 'Jane Doe';
  await saveProfile(profile);
  const loaded = await getProfile();
  assert.equal(loaded.personal.name, 'Jane Doe');
});

test('addLog prepends to log list', async () => {
  await addLog({ id: '1', company: 'ACME', role: 'Engineer', status: 'applied' });
  await addLog({ id: '2', company: 'Globex', role: 'Dev', status: 'applied' });
  const logs = await getLogs();
  assert.equal(logs[0].id, '2'); // newest first
  assert.equal(logs.length, 2);
});

test('updateLogStatus changes status of correct entry', async () => {
  await updateLogStatus('1', 'interviewing');
  const logs = await getLogs();
  const entry = logs.find(l => l.id === '1');
  assert.equal(entry.status, 'interviewing');
});

test('deleteLog removes correct entry', async () => {
  await deleteLog('1');
  const logs = await getLogs();
  assert.ok(!logs.find(l => l.id === '1'));
  assert.ok(logs.find(l => l.id === '2'));
});

test('setRegisterCache and getRegisterCache round-trip', async () => {
  const data = { last_updated: '2026-01-01', etag: 'abc123', entries: { acme: { status: 'licensed' } } };
  await setRegisterCache(data);
  const loaded = await getRegisterCache();
  assert.equal(loaded.etag, 'abc123');
  assert.ok(loaded.entries.acme);
});
