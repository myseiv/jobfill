// content/listing.js
// No shared imports needed — lookups are delegated to the service worker

const SITE_CONFIG = {
  'linkedin.com': {
    cardSelector: '.job-card-container',
    companySelector: '.job-card-container__company-name, .artdeco-entity-lockup__subtitle',
  },
  'indeed.com': {
    cardSelector: '[data-testid="slider_item"], .job_seen_beacon',
    companySelector: '[data-testid="company-name"], .companyName',
  },
};

function getSiteConfig() {
  const host = window.location.hostname;
  for (const [domain, config] of Object.entries(SITE_CONFIG)) {
    if (host.includes(domain)) return config;
  }
  return null;
}

function makeBadge(result) {
  const el = document.createElement('span');
  el.className = 'jobfill-badge';
  el.style.cssText =
    'display:inline-block;margin-left:6px;font-size:11px;font-weight:600;' +
    'padding:1px 6px;border-radius:3px;vertical-align:middle;cursor:default;';

  if (result?.status === 'licensed') {
    el.textContent = '✓ Sponsor';
    el.style.cssText += 'color:#166534;background:#dcfce7;';
    el.title = [result.tier, result.route].filter(Boolean).join(' · ') || 'Licensed sponsor';
  } else if (result?.status === 'not_found') {
    el.textContent = '✗ No licence';
    el.style.cssText += 'color:#991b1b;background:#fee2e2;';
    el.title = 'Not found in Home Office sponsor register';
  } else {
    el.textContent = '?';
    el.style.cssText += 'color:#78716c;background:#f5f5f4;';
    el.title = 'Register not yet loaded';
  }
  return el;
}

// Batch all unprocessed cards into a single service worker message.
// One wake-up, one JSON.parse, one round-trip — much faster than per-card messages.
async function processVisible(config) {
  const pending = [];
  for (const card of document.querySelectorAll(config.cardSelector)) {
    if (card.dataset.jobfillDone) continue;
    card.dataset.jobfillDone = 'true'; // mark before async to prevent duplicates
    const companyEl = card.querySelector(config.companySelector);
    if (!companyEl) continue;
    const name = companyEl.textContent.trim();
    if (name) pending.push({ card, name });
  }
  if (pending.length === 0) return;

  let results;
  try {
    results = await chrome.runtime.sendMessage({
      type: 'LOOKUP_COMPANIES_BATCH',
      names: pending.map(p => p.name),
    });
  } catch {
    results = pending.map(() => ({ status: 'unknown' }));
  }

  for (let i = 0; i < pending.length; i++) {
    const { card } = pending[i];
    const liveEl = card.querySelector(config.companySelector);
    if (!liveEl || card.querySelector('.jobfill-badge')) continue;
    liveEl.appendChild(makeBadge(results?.[i]));
  }
}

function init() {
  const config = getSiteConfig();
  if (!config) return;

  // Debounce so rapid progressive renders are batched into one processVisible call
  let timer = null;
  function scheduleProcess() {
    clearTimeout(timer);
    timer = setTimeout(() => processVisible(config), 120);
  }

  scheduleProcess(); // initial pass (cards already in DOM at script load)

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(document.body, { childList: true, subtree: true });
}

init();
