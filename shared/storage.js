// shared/storage.js
const PROFILE_KEY = 'jobfill_profile';
const LOGS_KEY = 'jobfill_logs';
const REGISTER_KEY = 'jobfill_register';

function defaultProfile() {
  return {
    personal: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
    experience: [],
    skills: [],
    education: [],
    blurbs: { summary_short: '', summary_long: '', why_engineering: '' },
    preferences: { api_key: '', model: 'llama-3.1-8b-instant', autofill_mode: 'manual' },
  };
}

export async function getProfile() {
  const result = await chrome.storage.local.get(PROFILE_KEY);
  return result[PROFILE_KEY] ?? defaultProfile();
}

export async function saveProfile(profile) {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
}

export async function getLogs() {
  const result = await chrome.storage.local.get(LOGS_KEY);
  return result[LOGS_KEY] ?? [];
}

export async function addLog(entry) {
  const logs = await getLogs();
  logs.unshift(entry);
  await chrome.storage.local.set({ [LOGS_KEY]: logs });
}

export async function updateLogStatus(id, status) {
  const logs = await getLogs();
  const entry = logs.find(l => l.id === id);
  if (entry) entry.status = status;
  await chrome.storage.local.set({ [LOGS_KEY]: logs });
}

export async function deleteLog(id) {
  const logs = await getLogs();
  await chrome.storage.local.set({ [LOGS_KEY]: logs.filter(l => l.id !== id) });
}

export async function getRegisterCache() {
  const result = await chrome.storage.local.get(REGISTER_KEY);
  return result[REGISTER_KEY] ?? null;
}

export async function setRegisterCache(data) {
  // Remove first to avoid quota errors when replacing a previously large value
  await chrome.storage.local.remove(REGISTER_KEY);
  await chrome.storage.local.set({ [REGISTER_KEY]: data });
}
