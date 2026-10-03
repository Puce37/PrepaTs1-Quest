'use strict';

/* ==========================================================
   SYNCHRONISATION GOOGLE DRIVE
   - Connexion via Google Identity Services (popup OAuth)
   - Droit demandé : drive.file = accès UNIQUEMENT au fichier
     créé par cette application (jamais au reste du Drive)
   - Fichier créé dans « Mon Drive » : QuestLog-sauvegarde.json
   Étapes de configuration : voir LISEZMOI.md
   ========================================================== */
const GOOGLE_CLIENT_ID = '286427687469-llqh1v5eqsoqk3ddqrc6p0anf9kmfo5j.apps.googleusercontent.com';
const DRIVE_FILE = 'QuestLog-sauvegarde.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file openid profile';
const FLAG = 'questlog.google';
const API = 'https://www.googleapis.com';

const TOK_KEY = 'questlog.gtok', USER_KEY = 'questlog.guser';
let gClient, gTok = null, gExp = 0, gPend = null, gNeed = false;
let gOn = false, gUser = null, gFileId = null, pushT = 0, busy = false, again = false;

/* ---------- Session mémorisée (le compte reste connecté après un rechargement) ----------
   - profil (nom, photo) : localStorage → affiché tout de suite au rechargement
   - jeton d'accès (1 h)  : sessionStorage → réutilisé tant qu'il est valide
   - jeton expiré : renouvelé au premier clic (Google exige un geste de l'utilisateur) */
function persist() {
  try {
    if (gTok) sessionStorage.setItem(TOK_KEY, JSON.stringify({ t: gTok, e: gExp }));
    if (gUser) localStorage.setItem(USER_KEY, JSON.stringify({ sub: gUser.sub, name: gUser.name, picture: gUser.picture }));
  } catch (e) {}
}

/* ---------- Interface ---------- */
const gst = (msg, err) => { const e = $('gstat'); if (e) { e.textContent = msg; e.classList.toggle('err', !!err); } };

function ui() {
  $('sync').innerHTML = gOn && gUser
    ? `<img class="av" src="${esc(gUser.picture || '')}" alt="" referrerpolicy="no-referrer"><strong>${esc(gUser.name || 'Connecté')}</strong>
       <span id="gstat" class="gstat" role="status"></span>${gNeed ? '<button class="gbtn" id="gren" type="button">Reprendre</button>' : ''}<button class="gbtn" id="gout" type="button">Se déconnecter</button>`
    : `<button class="gbtn" id="gin" type="button">☁️ Se connecter avec Google</button>
       <span id="gstat" class="gstat" role="status">Sauvegarde locale uniquement</span>`;
  if (typeof setAvatar === 'function') setAvatar(gOn && gUser ? gUser.picture : '');   // photo dans le cercle de niveau
}

/* ---------- Authentification ---------- */
const gReady = () => new Promise((ok, ko) => {
  let n = 0;
  const t = setInterval(() => {
    if (window.google && google.accounts && google.accounts.oauth2) { clearInterval(t); ok(); }
    else if (++n > 150) { clearInterval(t); ko(new Error('Bibliothèque Google introuvable (connexion ?)')); }
  }, 100);
});

function gClientInit() {
  if (gClient) return;
  gClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: r => {
      const p = gPend; gPend = null;
      if (r.error) return p && p.rej(r);
      gTok = r.access_token; gExp = Date.now() + (r.expires_in - 60) * 1000;
      persist();
      p && p.res(gTok);
    },
    error_callback: e => { const p = gPend; gPend = null; p && p.rej(e); }
  });
}

async function gToken(prompt) {
  if (gTok && Date.now() < gExp) return gTok;
  await gReady(); gClientInit();                         // fonctionne aussi après un rechargement de page
  return new Promise((res, rej) => {
    gPend = { res, rej };
    gClient.requestAccessToken({ prompt: prompt || '', ...(!prompt && gUser && gUser.sub ? { hint: gUser.sub } : {}) });
  });
}

async function gfetch(url, opt = {}, retry = true) {
  const t = await gToken();
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401 && retry) { gTok = null; return gfetch(url, opt, false); }
  if (!r.ok) throw new Error('Drive ' + r.status);
  return r;
}

async function gLogin(silent) {
  if (GOOGLE_CLIENT_ID.startsWith('COLLE_ICI')) return gst('Renseigne ton ID client Google dans js/drive.js (voir LISEZMOI.md).', true);
  if (location.protocol === 'file:') return gst('Google refuse les pages ouvertes en file:// : lance un serveur local (voir LISEZMOI.md).', true);
  try {
    gst('Connexion…');
    await gReady(); gClientInit();
    await gToken(silent ? '' : 'select_account');
    gOn = true; gNeed = false;
    try { localStorage.setItem(FLAG, '1'); } catch (e) {}
    const u = await (await gfetch(API + '/oauth2/v3/userinfo')).json().catch(() => ({}));
    gUser = { sub: u.sub, name: u.name, picture: u.picture }; persist();
    ui();
    await sync();
  } catch (e) {
    gOn = false; gUser = null; ui();
    gst(silent ? 'Session Google expirée : reconnecte-toi pour synchroniser.'
      : (e instanceof Error ? e.message : 'Connexion annulée ou refusée.'), !silent);
  }
}

function gLogout() {
  clearTimeout(pushT);
  gTok = null; gOn = false; gUser = null; gFileId = null; gNeed = false;
  try { localStorage.removeItem(FLAG); localStorage.removeItem(USER_KEY); sessionStorage.removeItem(TOK_KEY); } catch (e) {}
  ui();
}

/* ---------- Fichier Drive ---------- */
async function findFile() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const r = await gfetch(`${API}/drive/v3/files?q=${q}&fields=files(id)&orderBy=modifiedTime%20desc&pageSize=1`);
  const f = (await r.json()).files;
  return f && f[0] ? f[0].id : null;
}

const payload = () => JSON.stringify({ v: 1, quests: S.quests, base: S.base });

async function upload() {
  if (gFileId) {
    await gfetch(`${API}/upload/drive/v3/files/${gFileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload() });
  } else {
    const b = 'ql' + Date.now();
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: DRIVE_FILE, mimeType: 'application/json' })}\r\n` +
                 `--${b}\r\nContent-Type: application/json\r\n\r\n${payload()}\r\n--${b}--`;
    const r = await gfetch(`${API}/upload/drive/v3/files?uploadType=multipart&fields=id`,
      { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
    gFileId = (await r.json()).id;
  }
}

/* Fusion par quête : la version la plus récente (upd) l'emporte */
function mergeRemote(r) {
  const rq = r && Array.isArray(r.quests) ? r.quests : [];
  const L = new Map(S.quests.map(x => [x.id, x])), R = new Map(rq.map(x => [x.id, x]));
  let toLocal = false, toRemote = false;
  const out = [];
  new Set([...L.keys(), ...R.keys()]).forEach(id => {
    const a = L.get(id), b = R.get(id), ua = a ? a.upd || 0 : -1, ub = b ? b.upd || 0 : -1;
    if (ub > ua) { out.push(b); toLocal = true; }
    else { out.push(a); if (ua > ub) toRemote = true; }
  });
  const base = Math.max(S.base, (r && r.base) || 0);
  if (base !== S.base) toLocal = true;
  if (base !== ((r && r.base) || 0)) toRemote = true;
  S.quests = out; S.base = base;
  return { toLocal, toRemote };
}

/* Récupère, fusionne, puis renvoie sur Drive si nécessaire */
async function sync() {
  if (!gOn) return;
  if (busy) { again = true; return; }
  busy = true; gst('☁️ Synchronisation…');
  try {
    gFileId = gFileId || await findFile();
    let up = !gFileId;
    if (gFileId) {
      const remote = await (await gfetch(`${API}/drive/v3/files/${gFileId}?alt=media`)).json();
      const m = mergeRemote(remote);
      if (m.toLocal) { saveLocal(); render(); }
      up = m.toRemote;
    }
    if (up) await upload();
    gst('☁️ Synchronisé à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    console.error(e);
    if (e instanceof Error) {
      if (e.message === 'Drive 404') { gFileId = null; again = true; }
      else gst('⚠️ Erreur de synchronisation (' + e.message + ')', true);
    } else {
      gNeed = true; ui();                                // on reste connecté : il suffit de renouveler le jeton
      gst('Session expirée : appuie sur « Reprendre ».', true);
    }
  } finally {
    busy = false;
    if (again) { again = false; sync(); }
  }
}

/* Appelée par save() (script.js) après chaque modification */
function cloudPush() {
  if (!gOn) return;
  clearTimeout(pushT);
  gst('☁️ Modifications en attente…');
  pushT = setTimeout(sync, 1200);
}

/* ---------- Démarrage ---------- */
$('sync').addEventListener('click', e => {
  if (e.target.closest('#gin')) gLogin(false);
  else if (e.target.closest('#gout')) gLogout();
  else if (e.target.closest('#gren')) renew();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && gOn && gTok && Date.now() < gExp) sync(); });

/* Renouvelle le jeton (doit partir d'un clic) puis resynchronise */
async function renew() {
  try {
    gst('Reconnexion…');
    await gToken('');
    gNeed = false; persist(); ui();
    await sync();
  } catch (e) {
    gNeed = true; ui();
    gst('Session expirée : appuie sur « Reprendre » (ou reconnecte-toi).', true);
  }
}

/* Au chargement : on retrouve le compte au lieu de redemander la connexion */
function restore() {
  let u = null;
  try { if (!localStorage.getItem(FLAG)) return; u = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return; }
  if (!u) return;                                        // ancienne session sans profil mémorisé : écran de connexion
  gUser = u; gOn = true;
  try { const k = JSON.parse(sessionStorage.getItem(TOK_KEY) || 'null'); if (k && k.e > Date.now()) { gTok = k.t; gExp = k.e; } } catch (e) {}
  if (gTok) { ui(); sync(); return; }                    // jeton encore valide : synchro immédiate
  gNeed = true; ui();
  gst('Session à renouveler : touche l’écran pour te reconnecter.');
  document.addEventListener('click', e => { if (gNeed && !e.target.closest('#gout,#gren')) renew(); }, { once: true, capture: true });
}

ui();
restore();
