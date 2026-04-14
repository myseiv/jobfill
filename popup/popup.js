// popup/popup.js
import { getLogs } from '../shared/storage.js';

const ATS_PATTERNS = [/boards\.greenhouse\.io/, /jobs\.lever\.co/];
const WORKDAY_PATTERNS = [/myworkdayjobs\.com/, /workday\.com/];

async function init() {
  // Set settings link
  document.getElementById('settings-link').href = chrome.runtime.getURL('options/options.html');

  // Check if current tab is an ATS or Workday page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isAts = tab?.url && ATS_PATTERNS.some(p => p.test(tab.url));
  const isWorkday = tab?.url && WORKDAY_PATTERNS.some(p => p.test(tab.url));
  document.getElementById('fill-section').hidden = !isAts;
  document.getElementById('workday-section').hidden = !isWorkday;

  // Load recent applications
  renderRecent();

  // Fill button
  document.getElementById('fill-btn').addEventListener('click', async () => {
    const btn = document.getElementById('fill-btn');
    btn.disabled = true;
    btn.textContent = 'Filling…';
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL' });
      const { filled, skipped, errors } = response ?? {};
      const statusEl = document.getElementById('fill-status');
      if (filled === undefined) {
        statusEl.textContent = 'Could not reach content script. Reload the page and try again.';
      } else {
        statusEl.textContent = `${filled} filled · ${skipped} skipped${errors ? ` · ${errors} errors` : ''}`;
      }
    } catch {
      document.getElementById('fill-status').textContent = 'Error: reload the tab and try again.';
    }
    btn.disabled = false;
    btn.textContent = 'Fill this form';
  });

  // Sponsor lookup
  document.getElementById('lookup-input').addEventListener('input', async (e) => {
    const name = e.target.value.trim();
    const resultEl = document.getElementById('lookup-result');
    if (!name) { resultEl.textContent = ''; return; }
    const result = await chrome.runtime.sendMessage({ type: 'LOOKUP_COMPANY', name });
    if (result.status === 'licensed') {
      resultEl.textContent = `✓ Licensed — ${result.tier} · ${result.route}`;
      resultEl.style.color = '#166534';
    } else if (result.status === 'not_found') {
      resultEl.textContent = '✗ Not found in register';
      resultEl.style.color = '#991b1b';
    } else {
      resultEl.textContent = '? Register not yet loaded';
      resultEl.style.color = '#78716c';
    }
  });
}

async function renderRecent() {
  const logs = await getLogs();
  const list = document.getElementById('recent-list');
  const recent = logs.slice(0, 5);

  list.innerHTML = '';

  if (!recent.length) {
    const li = document.createElement('li');
    li.style.color = '#aaa';
    li.textContent = 'No applications logged yet.';
    list.appendChild(li);
    return;
  }

  recent.forEach(log => {
    const li = document.createElement('li');

    const textSpan = document.createElement('span');
    if (log.company) {
      const strong = document.createElement('strong');
      strong.textContent = log.company;
      textSpan.appendChild(strong);
      textSpan.appendChild(document.createTextNode(' — '));
    }
    textSpan.appendChild(document.createTextNode(log.role || 'Unknown role'));
    li.appendChild(textSpan);

    const status = log.status || 'applied';
    const badge = document.createElement('span');
    badge.className = `badge badge-${status}`;
    badge.textContent = status;
    li.appendChild(badge);

    list.appendChild(li);
  });
}

init();
