// options/options.js
import { getProfile, saveProfile, getLogs, updateLogStatus, deleteLog, getRegisterCache } from '../shared/storage.js';

let profile;

async function renderRegisterSettings() {
  const container = document.getElementById('register-content');
  const cache = await getRegisterCache();

  const lastUpdated = cache?.last_updated
    ? new Date(cache.last_updated).toLocaleString()
    : 'Never';
  const count = cache?.entry_count ? cache.entry_count.toLocaleString() : '0';

  container.innerHTML = '';

  const info = document.createElement('p');
  info.style.cssText = 'margin-bottom:12px;font-size:13px';
  const strong1 = document.createElement('strong');
  strong1.textContent = 'Last updated: ';
  info.appendChild(strong1);
  info.appendChild(document.createTextNode(lastUpdated));
  info.appendChild(document.createElement('br'));
  const strong2 = document.createElement('strong');
  strong2.textContent = 'Entries cached: ';
  info.appendChild(strong2);
  info.appendChild(document.createTextNode(count));
  container.appendChild(info);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.id = 'refresh-register-btn';
  refreshBtn.textContent = 'Refresh now';
  container.appendChild(refreshBtn);

  const refreshStatus = document.createElement('span');
  refreshStatus.id = 'refresh-status';
  refreshStatus.style.cssText = 'margin-left:10px;font-size:13px;color:#555';
  container.appendChild(refreshStatus);

  const caveat = document.createElement('p');
  caveat.style.cssText = 'margin-top:16px;font-size:12px;color:#888;line-height:1.5';
  caveat.innerHTML = '<strong>Limitations:</strong> The Home Office updates this register monthly — there is always a lag. A company not appearing does not confirm they won\'t sponsor. Name matching is imperfect for subsidiaries and trading names. Treat badge results as a signal, not a source of truth.';
  container.appendChild(caveat);

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshStatus.textContent = 'Refreshing…';
    try {
      const response = await chrome.runtime.sendMessage({ type: 'REFRESH_REGISTER' });
      if (response?.ok) {
        refreshStatus.textContent = 'Done.';
        await renderRegisterSettings();
      } else {
        refreshStatus.textContent = 'Failed. Check the console.';
        refreshBtn.disabled = false;
      }
    } catch {
      refreshStatus.textContent = 'Failed. Check the console.';
      refreshBtn.disabled = false;
    }
  });
}

async function load() {
  profile = await getProfile();
  renderProfile();
  renderApiSettings();
  renderTracker();
  renderRegisterSettings();
}

function renderProfile() {
  // Personal fields
  document.querySelectorAll('[data-field]').forEach(el => {
    const path = el.dataset.field.split('.');
    let val = profile;
    for (const key of path) val = val?.[key];
    if (el.tagName === 'TEXTAREA' && el.dataset.field === 'skills') {
      el.value = Array.isArray(val) ? val.join(', ') : '';
    } else {
      el.value = val ?? '';
    }
  });

  // Experience
  renderExperience();
  renderEducation();
}

function renderExperience() {
  const list = document.getElementById('experience-list');
  list.innerHTML = '';
  (profile.experience ?? []).forEach((exp, i) => {
    const div = document.createElement('div');
    div.className = 'exp-entry';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      profile.experience.splice(i, 1);
      renderExperience();
    });

    div.appendChild(removeBtn);

    const fields = [
      { label: 'Company', key: 'company', type: 'text', value: exp.company ?? '' },
      { label: 'Role', key: 'role', type: 'text', value: exp.role ?? '' },
      { label: 'Dates', key: 'dates', type: 'text', value: exp.dates ?? '' },
    ];
    fields.forEach(({ label, key, type, value }) => {
      const lbl = document.createElement('label');
      lbl.textContent = label + ' ';
      const input = document.createElement('input');
      input.type = type;
      input.dataset.exp = i;
      input.dataset.key = key;
      input.value = value;
      lbl.appendChild(input);
      div.appendChild(lbl);
    });

    const bulletsLabel = document.createElement('label');
    bulletsLabel.textContent = 'Bullets (one per line) ';
    const bulletsArea = document.createElement('textarea');
    bulletsArea.rows = 3;
    bulletsArea.dataset.exp = i;
    bulletsArea.dataset.key = 'bullets';
    bulletsArea.value = (exp.bullets ?? []).join('\n');
    bulletsLabel.appendChild(bulletsArea);
    div.appendChild(bulletsLabel);

    list.appendChild(div);
  });
}

function renderEducation() {
  const list = document.getElementById('education-list');
  list.innerHTML = '';
  (profile.education ?? []).forEach((edu, i) => {
    const div = document.createElement('div');
    div.className = 'edu-entry';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      profile.education.splice(i, 1);
      renderEducation();
    });

    div.appendChild(removeBtn);

    const fields = [
      { label: 'Institution', key: 'institution', value: edu.institution ?? '' },
      { label: 'Degree', key: 'degree', value: edu.degree ?? '' },
      { label: 'Dates', key: 'dates', value: edu.dates ?? '' },
    ];
    fields.forEach(({ label, key, value }) => {
      const lbl = document.createElement('label');
      lbl.textContent = label + ' ';
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.edu = i;
      input.dataset.key = key;
      input.value = value;
      lbl.appendChild(input);
      div.appendChild(lbl);
    });

    list.appendChild(div);
  });
}

async function renderTracker() {
  const container = document.getElementById('tracker-content');
  const logs = await getLogs();

  if (!logs.length) {
    container.innerHTML = '<p style="color:#aaa">No applications logged yet.</p>';
    return;
  }

  const STATUSES = ['applied', 'interviewing', 'rejected', 'offer'];

  const filterDiv = document.createElement('div');
  filterDiv.style.marginBottom = '12px';
  const filterLabel = document.createElement('label');
  filterLabel.style.cssText = 'font-size:12px;color:#555';
  filterLabel.textContent = 'Filter: ';
  const filterSelect = document.createElement('select');
  filterSelect.id = 'tracker-filter';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'All';
  filterSelect.appendChild(allOpt);
  STATUSES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    filterSelect.appendChild(opt);
  });
  filterLabel.appendChild(filterSelect);
  filterDiv.appendChild(filterLabel);

  function buildTable(entries) {
    if (!entries.length) {
      const p = document.createElement('p');
      p.style.color = '#aaa';
      p.textContent = 'No matching entries.';
      return p;
    }
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    ['Company', 'Role', 'Date', 'Status', ''].forEach((text, i) => {
      const th = document.createElement('th');
      th.style.cssText = `text-align:${i < 4 ? 'left' : 'center'};padding:6px 8px;border-bottom:2px solid #e5e5e5`;
      th.textContent = text;
      headerRow.appendChild(th);
    });
    const tbody = table.createTBody();
    entries.forEach(log => {
      const row = tbody.insertRow();
      row.style.borderBottom = '1px solid #f0f0f0';
      row.dataset.id = log.id;

      [log.company || '—', log.role || '—',
       log.date_applied ? new Date(log.date_applied).toLocaleDateString() : '—'
      ].forEach(text => {
        const td = row.insertCell();
        td.style.padding = '6px 8px';
        td.textContent = text;
      });

      const statusTd = row.insertCell();
      statusTd.style.padding = '6px 8px';
      const statusSel = document.createElement('select');
      statusSel.className = 'status-select';
      statusSel.dataset.id = log.id;
      STATUSES.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === log.status) opt.selected = true;
        statusSel.appendChild(opt);
      });
      statusTd.appendChild(statusSel);

      const deleteTd = row.insertCell();
      deleteTd.style.padding = '6px 8px';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'remove-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.dataset.id = log.id;
      deleteTd.appendChild(deleteBtn);
    });
    return table;
  }

  container.innerHTML = '';
  container.appendChild(filterDiv);
  let tableEl = buildTable(logs);
  container.appendChild(tableEl);

  function attachEvents() {
    container.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        await updateLogStatus(e.target.dataset.id, e.target.value);
      });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await deleteLog(e.target.dataset.id);
        await renderTracker();
      });
    });
  }

  filterSelect.addEventListener('change', async (e) => {
    const all = await getLogs();
    const filtered = e.target.value ? all.filter(l => l.status === e.target.value) : all;
    tableEl.remove();
    tableEl = buildTable(filtered);
    container.appendChild(tableEl);
    attachEvents();
  });

  attachEvents();
}

function renderApiSettings() {
  document.getElementById('api-key').value = profile.preferences?.api_key ?? '';
  document.getElementById('api-model').value = profile.preferences?.model ?? 'llama-3.1-8b-instant';
  document.getElementById('autofill-mode').value = profile.preferences?.autofill_mode ?? 'manual';
}

function collectProfile() {
  // Personal fields
  document.querySelectorAll('[data-field]').forEach(el => {
    const path = el.dataset.field.split('.');
    if (el.dataset.field === 'skills') {
      profile.skills = el.value.split(',').map(s => s.trim()).filter(Boolean);
      return;
    }
    let obj = profile;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = el.value;
  });

  // Experience
  document.querySelectorAll('[data-exp]').forEach(el => {
    const i = Number(el.dataset.exp);
    const key = el.dataset.key;
    if (!profile.experience[i]) return;
    if (key === 'bullets') {
      profile.experience[i].bullets = el.value.split('\n').map(s => s.trim()).filter(Boolean);
    } else {
      profile.experience[i][key] = el.value;
    }
  });

  // Education
  document.querySelectorAll('[data-edu]').forEach(el => {
    const i = Number(el.dataset.edu);
    const key = el.dataset.key;
    if (!profile.education[i]) return;
    profile.education[i][key] = el.value;
  });
}

// Event: save profile
document.getElementById('save-profile').addEventListener('click', async () => {
  collectProfile();
  await saveProfile(profile);
  const msg = document.getElementById('profile-saved');
  msg.hidden = false;
  setTimeout(() => { msg.hidden = true; }, 2000);
});

// Event: add experience
document.getElementById('add-exp').addEventListener('click', () => {
  profile.experience.push({ company: '', role: '', dates: '', bullets: [] });
  renderExperience();
});

// Event: add education
document.getElementById('add-edu').addEventListener('click', () => {
  profile.education.push({ institution: '', degree: '', dates: '' });
  renderEducation();
});

// Event: save API settings
document.getElementById('save-api').addEventListener('click', async () => {
  profile = await getProfile(); // reload to avoid stomping profile changes
  profile.preferences.api_key = document.getElementById('api-key').value.trim();
  profile.preferences.model = document.getElementById('api-model').value;
  profile.preferences.autofill_mode = document.getElementById('autofill-mode').value;
  await saveProfile(profile);
  const msg = document.getElementById('api-saved');
  msg.hidden = false;
  setTimeout(() => { msg.hidden = true; }, 2000);
});

load();
