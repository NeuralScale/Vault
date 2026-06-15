// Crypto
async function deriveKey(pw, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:200000, hash:'SHA-256' }, k, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
const b64 = b => btoa(Array.from(b, x => String.fromCharCode(x)).join(''));
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function enc(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}
async function dec(p, key) {
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: ub64(p.iv) }, key, ub64(p.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

// State
let key = null, vault = [], editId = null;

// Lock / Unlock
async function unlock() {
  if (!crypto?.subtle) {
    document.getElementById('lock-err').textContent = 'Encryption not available. Open via localhost or HTTPS.';
    return;
  }
  const pw = document.getElementById('mpw').value;
  const err = document.getElementById('lock-err');
  err.textContent = '';
  const saltKey = localStorage.getItem('v_salt');
  if (!saltKey) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      key = await deriveKey(pw, salt);
      localStorage.setItem('v_salt', b64(salt));
      vault = [];
      await save();
      showApp();
    } catch {
      err.textContent = 'Failed to create vault. Open via localhost or HTTPS.';
      key = null;
    }
    return;
  }
  const raw = localStorage.getItem('v_data');
  if (!raw) { err.textContent = 'Vault data missing. Reset the vault.'; return; }
  try {
    key = await deriveKey(pw, ub64(saltKey));
    vault = await dec(JSON.parse(raw), key);
    showApp();
  } catch {
    err.textContent = 'Wrong password.';
    key = null;
  }
}

function showApp() {
  document.getElementById('lock').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  render();
}

function lockApp() {
  key = null; vault = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('lock').style.display = 'flex';
  document.getElementById('mpw').value = '';
  document.getElementById('lock-err').textContent = '';
  document.getElementById('lock-btn').textContent = localStorage.getItem('v_salt') ? 'Unlock' : 'Create Vault';
}

// Persistence
async function save() {
  localStorage.setItem('v_data', JSON.stringify(await enc(vault, key)));
}

// Render
function render() {
  const q = document.getElementById('search').value.toLowerCase();
  const list = vault.filter(e =>
    !q || [e.name,e.user,e.url,e.notes].some(s => (s||'').toLowerCase().includes(q))
  ).sort((a,b) => (a.name||'').localeCompare(b.name||''));

  const tbody = document.getElementById('tbody');
  document.getElementById('empty').style.display = list.length ? 'none' : 'block';

  tbody.innerHTML = list.map(e => `
    <tr>
      <td data-label="Name"><strong>${esc(e.name)}</strong></td>
      <td data-label="Username">${esc(e.user)}${e.url && (e.url.startsWith('http://') || e.url.startsWith('https://')) ? `<br><a href="${esc(e.url)}" target="_blank" class="url-link">${esc(e.url)}</a>` : ''}</td>
      <td data-label="Password"><span class="pw-cell" id="pw-${e.id}">hidden</span></td>
      <td data-label="Notes" class="notes-cell">${esc(e.notes||'')}</td>
      <td data-label="">
        <div class="actions">
          <button class="btn btn-gray btn-sm" onclick="togglePw('${e.id}')">show</button>
          <button class="btn btn-gray btn-sm" onclick="copyById('${e.id}')">copy</button>
          <button class="btn btn-gray btn-sm" onclick="openEdit('${e.id}')">edit</button>
        </div>
      </td>
    </tr>`).join('');
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function togglePw(id) {
  const el = document.getElementById('pw-'+id);
  if (el.classList.contains('shown')) { el.textContent = 'hidden'; el.classList.remove('shown'); }
  else { el.textContent = vault.find(e => e.id === id)?.pw || ''; el.classList.add('shown'); }
}

function copyById(id) {
  copy(vault.find(e => e.id === id)?.pw || '');
}

function copy(text) {
  const fallback = () => {
    const t = document.createElement('textarea'); t.value = text;
    t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('Copied!')).catch(() => { fallback(); toast('Copied!'); });
  } else {
    fallback(); toast('Copied!');
  }
}

// Modal
function openAdd() {
  editId = null;
  document.getElementById('modal-title').textContent = 'New Entry';
  ['f-name','f-user','f-pw','f-url','f-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('del-btn').style.display = 'none';
  document.getElementById('modal').classList.add('open');
}

function openEdit(id) {
  const e = vault.find(x => x.id === id); if (!e) return;
  editId = id;
  document.getElementById('modal-title').textContent = 'Edit Entry';
  document.getElementById('f-name').value = e.name || '';
  document.getElementById('f-user').value = e.user || '';
  document.getElementById('f-pw').value = e.pw || '';
  document.getElementById('f-url').value = e.url || '';
  document.getElementById('f-notes').value = e.notes || '';
  document.getElementById('del-btn').style.display = 'inline-flex';
  document.getElementById('modal').classList.add('open');
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }

async function doSave() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { toast('Name is required'); return; }
  const entry = {
    id: editId || crypto.randomUUID(),
    name,
    user: document.getElementById('f-user').value.trim(),
    pw: document.getElementById('f-pw').value,
    url: document.getElementById('f-url').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
  };
  if (editId) { const i = vault.findIndex(e => e.id === editId); vault[i] = entry; }
  else vault.push(entry);
  await save(); closeModal(); render(); toast('Saved');
}

async function doDelete() {
  if (!confirm('Delete this entry?')) return;
  vault = vault.filter(e => e.id !== editId);
  await save(); closeModal(); render(); toast('Deleted');
}

function fillGen() {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const max = Math.floor(256 / c.length) * c.length;
  const out = [];
  while (out.length < 16) {
    const a = new Uint8Array(32); crypto.getRandomValues(a);
    for (const b of a) { if (b < max) { out.push(c[b % c.length]); if (out.length === 16) break; } }
  }
  document.getElementById('f-pw').value = out.join('');
}

// Toast
let toastT;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2000);
}

// Device / browser info
function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown browser';
}

function getDevice() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown device';
}

document.getElementById('lock-info').textContent =
  `Vault is tied to ${getBrowser()} on ${getDevice()} at ${location.host}`;

// Reset vault
function resetVault() {
  if (!confirm('This will permanently delete all saved passwords and create a new empty vault. Continue?')) return;
  localStorage.removeItem('v_salt');
  localStorage.removeItem('v_data');
  key = null; vault = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('lock').style.display = 'flex';
  document.getElementById('mpw').value = '';
  document.getElementById('lock-err').textContent = '';
  document.getElementById('lock-btn').textContent = 'Create Vault';
  document.getElementById('lock-info').textContent =
    `Vault is tied to ${getBrowser()} on ${getDevice()} at ${location.host}`;
  toast('Vault reset. Set a new password to begin.');
}

// Events
document.getElementById('mpw').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
document.getElementById('lock-btn').onclick = unlock;
document.getElementById('search').addEventListener('input', render);
document.getElementById('modal').addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });

// PWA
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
