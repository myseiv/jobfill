// content/application.js
// Dependencies inlined — no ES module imports needed for content scripts

// ── Inlined: storage.getProfile ──────────────────────────────────────────────

async function getProfile() {
  const result = await chrome.storage.local.get('jobfill_profile');
  return result['jobfill_profile'] ?? {
    personal: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
    experience: [],
    skills: [],
    education: [],
    blurbs: { summary_short: '', summary_long: '', why_engineering: '' },
    preferences: { api_key: '', model: 'llama-3.1-8b-instant', autofill_mode: 'manual' },
  };
}

// ── Groq via service worker (avoids page CSP) ────────────────────────────────

async function generateAnswer({ apiKey, model, fieldLabel, jdText, profileChunk }) {
  const result = await chrome.runtime.sendMessage({
    type: 'GROQ_ANSWER',
    apiKey,
    model,
    fieldLabel,
    jdText,
    profileChunk,
  });
  if (!result?.ok) throw new Error(result?.error ?? 'Groq request failed');
  return result.answer;
}

// ── Field classification ─────────────────────────────────────────────────────

const PERSONAL_KEYWORDS = {
  first_name: ['first name', 'given name', 'forename'],
  last_name:  ['last name', 'surname', 'family name'],
  name:       ['full name', 'fullname', 'your name', /^name$/],
  email:      ['email', 'e-mail', 'email address'],
  phone:      ['phone', 'telephone', 'mobile', 'contact number'],
  location:   ['location', 'city', 'address', 'where are you based', 'town'],
  linkedin:   ['linkedin'],
  github:     ['github'],
  portfolio:  ['portfolio', 'website', 'personal site'],
};

const SHORT_ANSWER_KEYWORDS = [
  'why', 'describe', 'tell us', 'what', 'how', 'experience with',
  'challenge', 'strength', 'weakness', 'motivat', 'interest',
  'contribution', 'passion', 'goal', 'background',
];

const DEMOGRAPHIC_KEYWORDS = [
  'gender', 'ethnicity', 'race', 'disability', 'veteran',
  'equal opportunit', 'diversit', 'pronouns',
];

function getFieldContext(el) {
  const attrs = [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute('aria-label'),
    el.getAttribute('aria-describedby'),
  ].filter(Boolean).join(' ');

  let labelText = '';
  const labelEl =
    (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
    el.closest('label');
  if (labelEl) {
    labelText = labelEl.textContent.trim();
  } else {
    let node = el.parentElement;
    for (let depth = 0; depth < 6 && node; depth++, node = node.parentElement) {
      const heading = node.querySelector(':scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > p');
      if (heading) { labelText = heading.textContent.trim(); break; }
    }
  }

  return `${attrs} ${labelText}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function matchesKeyword(text, keywords) {
  return keywords.some(kw =>
    kw instanceof RegExp ? kw.test(text) : text.includes(kw)
  );
}

function classifyField(el) {
  const context = getFieldContext(el);

  if (matchesKeyword(context, DEMOGRAPHIC_KEYWORDS)) {
    return { category: 'demographic', label: context };
  }

  for (const [subtype, keywords] of Object.entries(PERSONAL_KEYWORDS)) {
    if (matchesKeyword(context, keywords)) {
      return { category: 'personal', subtype, label: context };
    }
  }

  const isTextLike =
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && ['text', 'url'].includes(el.type));

  if (isTextLike && matchesKeyword(context, SHORT_ANSWER_KEYWORDS)) {
    return { category: 'short_answer', label: context };
  }

  return { category: 'unknown', label: context };
}

function detectFields() {
  const selector =
    'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea';
  return Array.from(document.querySelectorAll(selector))
    .filter(el => el.offsetParent !== null)
    .map(el => ({ el, ...classifyField(el) }));
}

// ── JD scraper ───────────────────────────────────────────────────────────────

function scrapeJD() {
  const titleEl = document.querySelector(
    'h1, [class*="job-title"], [class*="jobtitle"], [data-qa="job-title"]'
  );
  const title = titleEl?.textContent.trim() ?? document.title;

  const jdEl = document.querySelector(
    '#job_description, .job-description, [class*="job-description"], ' +
    '[data-qa="job-description"], main article, main section'
  );
  const jdText = (jdEl ?? document.body).innerText.trim().slice(0, 4000);

  let company = '';
  const ghMatch = window.location.pathname.match(/^\/([^/]+)\//);
  const levMatch = window.location.hostname === 'jobs.lever.co' &&
    window.location.pathname.match(/^\/([^/]+)\//);
  if ((window.location.hostname === 'boards.greenhouse.io' || window.location.hostname === 'job-boards.greenhouse.io') && ghMatch) {
    company = ghMatch[1].replace(/-/g, ' ');
  } else if (levMatch) {
    company = levMatch[1].replace(/-/g, ' ');
  }

  return { title, company, jdText, url: window.location.href };
}

// ── Fill helpers ─────────────────────────────────────────────────────────────

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillPersonal(el, subtype, profile) {
  let value;
  if (subtype === 'first_name') {
    const parts = (profile.personal?.name ?? '').trim().split(/\s+/);
    value = parts[0] ?? '';
  } else if (subtype === 'last_name') {
    const parts = (profile.personal?.name ?? '').trim().split(/\s+/);
    value = parts.length > 1 ? parts.slice(1).join(' ') : '';
  } else {
    value = profile.personal?.[subtype] ?? '';
  }
  if (!value) return false;
  setNativeValue(el, value);
  return true;
}

async function fillShortAnswer(el, label, profile, jdText) {
  const apiKey = profile.preferences?.api_key;
  if (!apiKey) return 'no_key';

  const parts = [];
  if (profile.blurbs?.summary_long) parts.push(`Summary: ${profile.blurbs.summary_long}`);
  if (profile.skills?.length)        parts.push(`Skills: ${profile.skills.join(', ')}`);
  if (profile.experience?.length) {
    const exp = profile.experience
      .map(e => `${e.role} at ${e.company} (${e.dates}): ${(e.bullets ?? []).join('; ')}`)
      .join('\n');
    parts.push(`Experience:\n${exp}`);
  }
  const profileChunk = parts.join('\n\n').slice(0, 1500);

  try {
    const answer = await generateAnswer({
      apiKey,
      model: profile.preferences.model ?? 'llama-3.1-8b-instant',
      fieldLabel: label,
      jdText: jdText ?? '',
      profileChunk,
    });
    setNativeValue(el, answer);
    return 'filled';
  } catch {
    return 'error';
  }
}

// ── State + init ─────────────────────────────────────────────────────────────

let fieldCache = null;
let jdData = null;

async function init() {
  await new Promise(r => setTimeout(r, 300));

  jdData = scrapeJD();
  fieldCache = detectFields();

  if (window.location.hostname === 'jobs.lever.co') {
    const observer = new MutationObserver(() => {
      fieldCache = detectFields();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  }
}

// ── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FILL') {
    handleFill().then(sendResponse);
    return true;
  }
});

async function handleFill() {
  fieldCache = detectFields(); // always re-detect to catch dynamically added fields
  const profile = await getProfile();
  const jdText = jdData?.jdText ?? '';

  let filled = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of fieldCache) {
    if (field.category === 'personal') {
      const ok = fillPersonal(field.el, field.subtype, profile);
      ok ? filled++ : skipped++;
    } else if (field.category === 'short_answer') {
      const result = await fillShortAnswer(field.el, field.label, profile, jdText);
      if (result === 'filled') filled++;
      else if (result === 'no_key') skipped++;
      else errors++;
    } else {
      skipped++;
    }
  }

  return { filled, skipped, errors };
}

init();

// ── Submission detection ─────────────────────────────────────────────────────

document.addEventListener(
  'submit',
  () => {
    const entry = {
      id: crypto.randomUUID(),
      site: window.location.hostname,
      company: jdData?.company ?? '',
      role: jdData?.title ?? '',
      url: window.location.href,
      date_applied: new Date().toISOString(),
      status: 'applied',
      jd_text: jdData?.jdText ?? '',
      fit_score: null,
      fields_filled: (fieldCache ?? []).map(f => f.label),
    };
    chrome.runtime.sendMessage({ type: 'APP_SUBMITTED', entry });
  },
  { once: true }
);
