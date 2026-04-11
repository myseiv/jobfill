// background/service-worker.js
import * as XLSX from '../vendor/xlsx.mjs';
import { normalise, lookup } from '../shared/normalise.js';
import { getRegisterCache, setRegisterCache, addLog } from '../shared/storage.js';

const REGISTER_API_URL =
  'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers';
const CACHE_NAME = 'jobfill-register-v1';
// Fixed key used to store the pre-parsed entries JSON in the Cache API.
// Using jobfill.invalid (reserved TLD) as a safe non-resolvable URL.
const ENTRIES_CACHE_URL = 'https://jobfill.invalid/entries.json';

// Module-level entries cache — valid for the lifetime of this service worker instance.
// Repopulated from Cache API on each new service worker startup.
let entriesCache = null;
// Dedup concurrent loads so multiple simultaneous lookups don't each trigger a JSON.parse.
let loadingPromise = null;

function parseCSVToEntries(csvText) {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  const entries = {};
  for (const row of rows) {
    const orgName =
      row['Organisation Name'] ??
      row['Organisation name'] ??
      row['organisation name'] ??
      '';
    if (!orgName) continue;
    const key = normalise(String(orgName));
    if (!key) continue;
    entries[key] = {
      status: 'licensed',
      tier: String(row['Type & Rating'] ?? row['Type and Rating'] ?? ''),
      route: String(row['Route'] ?? ''),
    };
  }
  return entries;
}

// Load parsed entries from the Cache API.
// Stores pre-parsed JSON so wake-up is fast — JSON.parse not SheetJS.
// Uses a dedup promise so concurrent lookups share one load operation.
function loadEntriesFromCacheAPI() {
  if (entriesCache) return Promise.resolve(entriesCache);
  if (loadingPromise) return loadingPromise;
  loadingPromise = caches.open(CACHE_NAME)
    .then(cache => cache.match(ENTRIES_CACHE_URL))
    .then(response => response ? response.json() : null)
    .then(entries => { entriesCache = entries; return entries; })
    .catch(() => null)
    .finally(() => { loadingPromise = null; });
  return loadingPromise;
}

export async function downloadAndCacheRegister() {
  try {
    // Step 1: use gov.uk Content API to get the CSV attachment URL (JSON, no scraping)
    const apiResponse = await fetch(REGISTER_API_URL);
    if (!apiResponse.ok) throw new Error(`gov.uk API error: ${apiResponse.status}`);
    const apiJson = await apiResponse.json();
    const attachment = apiJson?.details?.attachments?.find(
      a => a.content_type === 'text/csv' || a.url?.endsWith('.csv')
    );
    if (!attachment?.url) throw new Error('Could not find CSV attachment in gov.uk API response');
    const csvUrl = attachment.url;

    // Step 2: ETag check — only skip if parsed entries are already in Cache API
    const existing = await getRegisterCache();
    const headResponse = await fetch(csvUrl, { method: 'HEAD' });
    const etag = headResponse.headers.get('ETag') ?? '';
    if (existing?.etag && existing.etag === etag) {
      const cacheCheck = await caches.open(CACHE_NAME);
      const cached = await cacheCheck.match(ENTRIES_CACHE_URL);
      if (cached) {
        console.log('JobFill: register unchanged, skipping re-download');
        if (!entriesCache) await loadEntriesFromCacheAPI();
        return;
      }
    }

    // Step 3: download CSV
    const csvResponse = await fetch(csvUrl);
    const csvText = await csvResponse.text();

    // Step 4: parse into module-level variable
    entriesCache = parseCSVToEntries(csvText);

    // Step 5: store parsed entries as JSON in Cache API (fast to load on service worker wake)
    const cache = await caches.open(CACHE_NAME);
    await cache.put(ENTRIES_CACHE_URL, new Response(JSON.stringify(entriesCache), {
      headers: { 'Content-Type': 'application/json' },
    }));

    // Step 6: store lightweight metadata in chrome.storage.local
    await setRegisterCache({
      last_updated: new Date().toISOString(),
      etag,
      entry_count: Object.keys(entriesCache).length,
    });

    console.log(`JobFill: register cached — ${Object.keys(entriesCache).length} entries`);
  } catch (err) {
    console.error('JobFill: register download failed', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Migrate: remove old register data that stored full entries (pre-Cache API approach)
  const stale = await getRegisterCache();
  if (stale?.entries) await chrome.storage.local.remove('jobfill_register');

  await downloadAndCacheRegister();
  chrome.alarms.create('refresh-register', { periodInMinutes: 7 * 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh-register') {
    await downloadAndCacheRegister();
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOOKUP_COMPANY') {
    handleLookup(message.name).then(sendResponse);
    return true;
  }
  if (message.type === 'LOOKUP_COMPANIES_BATCH') {
    handleBatchLookup(message.names).then(sendResponse);
    return true;
  }
  if (message.type === 'APP_SUBMITTED') {
    addLog(message.entry).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'REFRESH_REGISTER') {
    downloadAndCacheRegister().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'GROQ_ANSWER') {
    handleGroqAnswer(message).then(sendResponse);
    return true;
  }
});

async function handleGroqAnswer({ apiKey, model, fieldLabel, jdText, profileChunk }) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model ?? 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are helping fill in a job application. Answer concisely in 2-4 sentences. Write in first person. Do not use bullet points. Answer only the specific question asked.',
          },
          {
            role: 'user',
            content: `Job description:\n${jdText}\n\nApplicant profile:\n${profileChunk}\n\nQuestion/field: "${fieldLabel}"\n\nWrite a short answer for this field.`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });
    if (!response.ok) return { ok: false, error: `Groq API error: ${response.status}` };
    const data = await response.json();
    return { ok: true, answer: data.choices[0].message.content.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleLookup(name) {
  const entries = await loadEntriesFromCacheAPI();
  if (!entries) return { status: 'unknown' };
  const result = lookup(name, entries);
  if (!result) return { status: 'not_found' };
  return { status: 'licensed', tier: result.tier, route: result.route };
}

async function handleBatchLookup(names) {
  const entries = await loadEntriesFromCacheAPI();
  if (!entries) return names.map(() => ({ status: 'unknown' }));
  // Exact match only — no Levenshtein scan. Fuzzy over 124k entries × 32 names
  // would lock the service worker for several seconds.
  return names.map(name => {
    const key = normalise(name);
    const entry = entries[key];
    if (!entry) return { status: 'not_found' };
    return { status: 'licensed', tier: entry.tier, route: entry.route };
  });
}
