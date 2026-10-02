'use strict';

/* ==========================================================
   CONFIGURATION
   Les trophées sont les images du dossier /images.
   Pour changer un chemin ou une extension, modifie "img".
   "fb" = emoji de secours si l'image est introuvable.
   ========================================================== */
const KEY = 'questlog.v1';
const XP_PAR_NIVEAU = 100;
const RANKS = ['Novice', 'Apprenti', 'Aventurier', 'Vétéran', 'Héros', 'Légende'];

/* Musiques fournies avec l'appli : place tes MP3 dans /music puis liste-les ici.
   (Tu peux aussi en ajouter depuis le lecteur avec le bouton « Ajouter des MP3 ».) */
const PLAYLIST = [
  // { title: 'Mon morceau', src: 'music/mon-morceau.mp3' },
];

const CAT = {
  main: ['🔥', 'Principale'],
  side: ['📜', 'Secondaire'],
  opt:  ['💡', 'Facultative'],
  urg:  ['🚨', 'Urgente']
};

const DIF = {
  easy: { label: 'Facile',    xp: 25,  color: '#22c55e', trophy: 'Bronze',  img: 'images/bronze.png',  fb: '🥉' },
  mid:  { label: 'Moyenne',   xp: 50,  color: '#3b82f6', trophy: 'Argent',  img: 'images/argent.png',  fb: '🥈' },
  hard: { label: 'Difficile', xp: 100, color: '#f97316', trophy: 'Or',      img: 'images/or.png',      fb: '🥇' },
  epic: { label: 'Épique',    xp: 250, color: '#a855f7', trophy: 'Platine', img: 'images/platine.png', fb: '💎' }
};

/* ==========================================================
   ÉTAT + SAUVEGARDE (LocalStorage)
   ========================================================== */
let S = { quests: [], base: 0, theme: '', sound: true, vol: .5, track: -1, mp: false };
let view = 'todo', cat = 'all', q = '', fresh = '', selDif = 'mid';

try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}

/* Migration des anciennes sauvegardes + XP calculé à partir des quêtes
   (les quêtes supprimées restent en « suppression douce » : leur XP est conservé
   et la synchronisation Drive peut fusionner plusieurs appareils sans conflit) */
S.quests.forEach(x => { x.upd = x.upd || x.doneAt || x.at; });
const xpQuetes = () => S.quests.reduce((n, x) => n + (x.done ? DIF[x.dif].xp : 0), 0);
if (S.xp !== undefined) { S.base = Math.max(S.base || 0, S.xp - xpQuetes()); delete S.xp; }
S.base = Math.max(0, S.base || 0);
const xpTotal = () => S.base + xpQuetes();

const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const save = () => { saveLocal(); if (typeof cloudPush === 'function') cloudPush(); };

/* ==========================================================
   OUTILS
   ========================================================== */
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Image de trophée (cls : "tro" pour les cartes, "trb" pour le sélecteur) */
const trophy = (k, cls) => {
  const d = DIF[k];
  return `<img class="${cls}" src="${d.img}" alt="Trophée ${d.trophy}" title="Trophée ${d.trophy}" data-fb="${d.fb}">`;
};

/* Si une image est absente : on la remplace par l'emoji de secours */
document.addEventListener('error', e => {
  const i = e.target;
  if (i.tagName === 'IMG' && i.dataset.fb) {
    const s = document.createElement('span');
    s.className = i.className; s.title = i.title; s.textContent = i.dataset.fb;
    i.replaceWith(s);
  }
}, true);

/* ==========================================================
   SONS (Web Audio API, aucun fichier externe)
   ========================================================== */
let ac;
function snd(k) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    ac.resume();
    const n = ac.currentTime;
    const seq = {
      add:  [[523, 0], [784, .08]],
      done: [[523, 0], [659, .07], [784, .14], [1047, .21]],
      del:  [[300, 0], [180, .09]],
      lvl:  [[523, 0], [659, .1], [784, .2], [1047, .3], [1319, .4]]
    }[k];
    seq.forEach(([f, t]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = k === 'del' ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(.12, n + t);
      g.gain.exponentialRampToValueAtTime(.001, n + t + .18);
      o.connect(g); g.connect(ac.destination);
      o.start(n + t); o.stop(n + t + .2);
    });
  } catch (e) {}
}

/* ==========================================================
   PARTICULES + TEXTE FLOTTANT
   ========================================================== */
function burst(x, y, col, txt) {
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('i'), a = Math.random() * 6.28, d = 40 + Math.random() * 70;
    p.className = 'pt';
    p.style.cssText = `left:${x}px;top:${y}px;background:${col}`;
    document.body.appendChild(p);
    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }
    ], { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => p.remove();
  }
  const t = document.createElement('b');
  t.className = 'fl'; t.textContent = txt;
  t.style.cssText = `left:${x}px;top:${y}px;color:${col}`;
  document.body.appendChild(t);
  t.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-90%) scale(1.2)', opacity: 1, offset: .25 },
    { transform: 'translate(-50%,-260%) scale(1)', opacity: 0 }
  ], { duration: 1200, easing: 'ease-out' }).onfinish = () => t.remove();
}

/* ==========================================================
   RENDU
   ========================================================== */
function head() {
  const xp = xpTotal(), lvl = Math.floor(xp / XP_PAR_NIVEAU) + 1, p = xp % XP_PAR_NIVEAU;
  const vis = S.quests.filter(x => !x.del), tot = vis.length, dn = vis.filter(x => x.done).length;
  $('lv').textContent = lvl;
  $('rank').textContent = RANKS[Math.min(Math.floor((lvl - 1) / 3), RANKS.length - 1)];
  $('xpt').textContent = `· ${p} / ${XP_PAR_NIVEAU} XP (total ${xp})`;
  $('bar').style.width = p + '%';
  $('s1').textContent = tot;
  $('s2').textContent = dn;
  $('s3').textContent = (tot ? Math.round(dn / tot * 100) : 0) + '%';
  $('n1').textContent = `(${tot - dn})`;
  $('n2').textContent = `(${dn})`;
}

function render() {
  head();
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
  document.querySelectorAll('#chips .chip').forEach(b => b.classList.toggle('on', b.dataset.c === cat));

  const list = S.quests
    .filter(x => !x.del && x.done === (view === 'done') && (cat === 'all' || x.cat === cat) && (x.title + ' ' + x.desc).toLowerCase().includes(q))
    .sort((a, b) => view === 'done'
      ? (b.doneAt || 0) - (a.doneAt || 0)
      : ((b.cat === 'urg') - (a.cat === 'urg')) || (dl(a) - dl(b)) || b.at - a.at);

  $('list').innerHTML = list.length ? list.map(x => {
    const d = DIF[x.dif], c = CAT[x.cat];
    return `<article class="q${x.id === fresh ? ' new' : ''}${x.done ? ' done' : ''}" data-id="${x.id}" style="--c:${d.color}">
  <button class="chk" data-act="ok" aria-label="${x.done ? 'Rouvrir la quête' : 'Valider la quête'}">${x.done ? '✓' : ''}</button>
  <div class="bd">
    <h3>${esc(x.title)}</h3>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}
    <div class="tags">
      <span class="tg${x.cat === 'urg' && !x.done ? ' pulse' : ''}">${c[0]} ${c[1]}</span>
      <span class="tg" style="color:${d.color}">${trophy(x.dif, 'tro')} ${d.label} · +${d.xp} XP</span>
      ${dueTag(x)}
    </div>
  </div>
  <button class="del" data-act="del" aria-label="Supprimer la quête">✕</button>
</article>`;
  }).join('') : `<div class="empty">${
    q || cat !== 'all' ? 'Aucune quête ne correspond à ces filtres.'
    : view === 'todo' ? 'Aucune quête en cours. Ajoutez-en une pour lancer l’aventure !'
    : 'Aucune quête terminée pour l’instant.'}</div>`;
  fresh = '';
}

/* Sélecteur de difficulté (trophées), construit une seule fois */
function buildPicker() {
  $('dif').innerHTML = Object.entries(DIF).map(([k, d]) =>
    `<button type="button" class="pk${k === selDif ? ' on' : ''}" role="radio" aria-checked="${k === selDif}" data-k="${k}" style="--c:${d.color}" title="Trophée ${d.trophy}">
  ${trophy(k, 'trb')}<b>${d.label}</b><small>+${d.xp} XP</small></button>`).join('');
}

/* ==========================================================
   ACTIONS
   ========================================================== */
$('dif').addEventListener('click', e => {
  const b = e.target.closest('.pk'); if (!b) return;
  selDif = b.dataset.k;
  document.querySelectorAll('.pk').forEach(p => {
    const on = p === b;
    p.classList.toggle('on', on); p.setAttribute('aria-checked', on);
  });
});

$('f').addEventListener('submit', e => {
  e.preventDefault();
  const t = $('t').value.trim(); if (!t) return;
  const x = { id: Date.now() + '-' + Math.floor(Math.random() * 999), title: t, cat: $('c').value, dif: selDif, desc: $('ds').value.trim(), done: false, at: Date.now(), upd: Date.now(), due: selDate, dueT: selDate ? selTime : '' };
  S.quests.unshift(x);
  fresh = x.id; view = 'todo'; cat = 'all'; q = ''; $('q').value = '';
  $('t').value = ''; $('ds').value = '';
  selDate = selTime = ''; $('ct').value = ''; dlbl(); calOpen(false);
  save(); snd('add'); render();
});

$('list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const el = b.closest('.q');
  if (el.classList.contains('leave') || el.classList.contains('gone')) return;
  const x = S.quests.find(v => v.id === el.dataset.id); if (!x) return;

  if (b.dataset.act === 'del') {                       // Suppression
    el.classList.add('gone');
    x.del = true; x.upd = Date.now();
    save(); snd('del'); setTimeout(render, 300);

  } else if (!x.done) {                                // Validation
    const d = DIF[x.dif], r = b.getBoundingClientRect(), oldL = Math.floor(xpTotal() / XP_PAR_NIVEAU) + 1;
    el.classList.add('leave');
    burst(r.left + 13, r.top + 13, d.color, '+' + d.xp + ' XP');
    x.done = true; x.doneAt = x.upd = Date.now();
    save(); snd('done'); head();
    const nl = Math.floor(xpTotal() / XP_PAR_NIVEAU) + 1;
    if (nl > oldL) setTimeout(() => {
      snd('lvl');
      const l = $('lv').getBoundingClientRect();
      burst(l.left + 29, l.top + 29, '#fbbf24', '⭐ Niveau ' + nl + ' !');
    }, 450);
    setTimeout(render, 380);

  } else {                                             // Retour « En cours »
    x.done = false; delete x.doneAt; x.upd = Date.now(); fresh = x.id;
    save(); snd('add'); render();
  }
});

$('seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { view = b.dataset.v; render(); } });
$('chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { cat = b.dataset.c; render(); } });
$('q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });

/* ==========================================================
   THÈMES + SON
   ========================================================== */
function theme(t) {
  if (t) { document.documentElement.dataset.theme = t; S.theme = t; }
  const cur = S.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  document.querySelectorAll('#themes [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === cur));
  fx(cur);
}
$('themes').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { theme(b.dataset.t); save(); } });

function sndBtn() { $('snd').textContent = S.sound ? '🔊' : '🔇'; $('snd').classList.toggle('on', S.sound); }
$('snd').addEventListener('click', () => { S.sound = !S.sound; save(); sndBtn(); snd('add'); });

/* ==========================================================
   AMBIANCE DES THÈMES (feuilles, traînées Tron, ville de nuit)
   ========================================================== */
const rnd = (a, b) => a + Math.random() * (b - a);

/* Ville de nuit : étoiles, lune et deux plans de buildings générés au hasard (SVG) */
function cityHTML() {
  const W = 1600, pal = ['#ffd98a', '#ffb3e6', '#b9a0ff', '#8fe3ff'];
  const layer = (fill, hMin, hMax, litP, op) => {
    let x = -10, s = '';
    while (x < W) {
      const bw = Math.round(rnd(38, 100)), bh = Math.round(rnd(hMin, hMax)), y = 300 - bh;
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${fill}"/>`;
      if (bh > hMax * .85) s += `<rect x="${x + bw / 2 - 1}" y="${y - 24}" width="2" height="24" fill="${fill}"/><circle class="bl" cx="${x + bw / 2}" cy="${y - 25}" r="2.4" fill="#ff4d6d" style="animation-delay:-${rnd(0, 3).toFixed(1)}s"/>`;
      for (let wx = x + 7; wx < x + bw - 8; wx += 13)
        for (let wy = y + 10; wy < 290; wy += 16)
          if (Math.random() < litP)
            s += `<rect${Math.random() < .07 ? ` class="tw" style="animation-delay:-${rnd(0, 4).toFixed(1)}s"` : ''} x="${wx}" y="${wy}" width="5" height="7" fill="${pal[Math.floor(rnd(0, pal.length))]}" opacity="${op}"/>`;
      x += bw + Math.round(rnd(0, 6));
    }
    return `<svg class="sk" viewBox="0 0 ${W} 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${s}</svg>`;
  };
  let stars = '';
  for (let i = 0; i < 46; i++)
    stars += `<i class="star" style="left:${rnd(0, 100)}%;top:${rnd(0, 55)}%;--s:${rnd(1, 2.6).toFixed(1)}px;animation-duration:${rnd(2, 5).toFixed(1)}s;animation-delay:-${rnd(0, 5).toFixed(1)}s"></i>`;
  return stars + '<div class="moon"></div><i class="haze"></i><i class="shoot"></i>' + layer('#2b1a55', 120, 240, .17, .55) + layer('#150c2e', 60, 170, .24, 1);
}
function fx(t) {
  const f = $('fx'); f.className = t; let h = '';
  if (t === 'forest') for (let i = 0; i < 26; i++)
    h += `<i class="leaf" style="left:${rnd(0, 100)}%;--s:${rnd(8, 17)}px;--dx:${rnd(-70, 70)}px;--lc:hsl(${rnd(70, 130)},60%,${rnd(38, 62)}%);animation-duration:${rnd(9, 18)}s;animation-delay:-${rnd(0, 18)}s"></i>`;
  if (t === 'tron') for (let i = 0; i < 9; i++) {
    const v = i % 3 === 2, col = i % 2 ? '#ff7a1a' : '#00e5ff';
    h += `<i class="trail${v ? ' v' : ''}" style="--tc:${col};${v ? 'left' : 'top'}:${rnd(3, 97)}%;animation-duration:${rnd(3, 7)}s;animation-delay:-${rnd(0, 7)}s"></i>`;
  }
  if (t === 'city') h = cityHTML();
  f.innerHTML = h;
}

/* ==========================================================
   MUSIQUE MP3
   - pistes de PLAYLIST (dossier /music)
   - pistes ajoutées par l'utilisateur, gardées dans IndexedDB
   (réglages du lecteur : saveLocal, jamais envoyés sur Drive)
   ========================================================== */
const au = new Audio();
const fill = el => el.style.setProperty('--p', (el.value - el.min) / (el.max - el.min) * 100 + '%');
let tracks = PLAYLIST.map(t => ({ title: t.title, src: t.src, id: null })), cur = -1;

const idb = () => new Promise((ok, ko) => {
  const r = indexedDB.open('questlog-music', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('m', { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
});
async function dbRun(mode, fn) {
  const db = await idb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('m', mode), r = fn(tx.objectStore('m'));
    tx.oncomplete = () => ok(r.result); tx.onerror = () => ko(tx.error);
  });
}

function drawMusic() {
  const t = tracks[cur];
  $('np').textContent = t ? t.title : 'Aucune piste';
  $('pp').textContent = au.paused ? '▶' : '⏸';
  $('mus').classList.toggle('on', !au.paused);
  $('mp').classList.toggle('playing', !au.paused);
  $('tl').innerHTML = tracks.length ? tracks.map((t, i) =>
    `<div class="tk${i === cur ? ' on' : ''}" data-i="${i}"><span>${i === cur && !au.paused ? '🔊' : '🎶'} ${esc(t.title)}</span>${t.id != null ? `<button data-rm="${i}" aria-label="Retirer la piste">✕</button>` : ''}</div>`).join('')
    : '<div class="empty">Aucune musique. Ajoute des MP3 avec le bouton ci-dessous.</div>';
}
function load(i, play) {
  if (!tracks.length) return;
  cur = (i + tracks.length) % tracks.length;
  au.src = tracks[cur].src; S.track = cur; saveLocal();
  if (play) au.play().catch(() => {});
  drawMusic();
}
const toggleMusic = () => cur < 0 ? load(0, true) : au.paused ? au.play().catch(() => {}) : au.pause();

au.addEventListener('play', drawMusic);
au.addEventListener('pause', drawMusic);
au.addEventListener('ended', () => load(cur + 1, true));
au.addEventListener('timeupdate', () => { if (au.duration) { $('sk').value = au.currentTime / au.duration * 100; fill($('sk')); } });
au.addEventListener('error', () => { if (tracks[cur]) $('np').textContent = '⚠️ Fichier introuvable : ' + tracks[cur].title; });

$('pp').onclick = toggleMusic;
$('nx').onclick = () => load(cur + 1, true);
$('pv').onclick = () => load(cur < 0 ? 0 : cur - 1, true);
$('sk').oninput = e => { if (au.duration) au.currentTime = e.target.value / 100 * au.duration; fill(e.target); };
$('vol').oninput = e => { au.volume = S.vol = +e.target.value; fill(e.target); saveLocal(); };
$('mus').onclick = () => { S.mp = !S.mp; $('mp').hidden = !S.mp; saveLocal(); };
$('add').onclick = () => $('mf').click();

$('mf').addEventListener('change', async e => {
  for (const f of e.target.files) {
    const title = f.name.replace(/\.[^.]+$/, ''); let id = null;
    try { id = await dbRun('readwrite', s => s.add({ title, blob: f })); } catch (er) {}   // sinon : valable pour la session
    tracks.push({ title, src: URL.createObjectURL(f), id });
  }
  e.target.value = '';
  if (cur < 0 && tracks.length) load(0, true); else drawMusic();
});

$('tl').addEventListener('click', async e => {
  const row = e.target.closest('.tk'); if (!row) return;
  const i = +row.dataset.i;
  if (e.target.closest('[data-rm]')) {                 // Retirer une piste ajoutée
    const t = tracks[i];
    try { await dbRun('readwrite', s => s.delete(t.id)); } catch (er) {}
    URL.revokeObjectURL(t.src); tracks.splice(i, 1);
    if (i === cur) { au.pause(); au.removeAttribute('src'); cur = -1; } else if (i < cur) cur--;
    drawMusic();
  } else if (i === cur) toggleMusic(); else load(i, true);
});

async function initMusic() {
  au.volume = S.vol; $('vol').value = S.vol; fill($('vol')); $('mp').hidden = !S.mp;
  try { (await dbRun('readonly', s => s.getAll())).forEach(m => tracks.push({ title: m.title, src: URL.createObjectURL(m.blob), id: m.id })); } catch (er) {}
  if (tracks[S.track]) load(S.track, false); else drawMusic();
}

/* ==========================================================
   ÉCHÉANCES : calendrier + temps restant
   - due = « AAAA-MM-JJ », dueT = « HH:MM » (facultatif, sinon 23:59)
   ========================================================== */
const DAY = 864e5, pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dl = x => x.due ? new Date(`${x.due}T${x.dueT || '23:59'}`).getTime() : Infinity;
const dlab = (d, t, long) => new Date(d + 'T12:00').toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }) + (t ? ' · ' + t : '');

function remain(end) {
  const ms = end - Date.now(), m = Math.floor(Math.abs(ms) / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
  const t = d >= 7 ? `${d} j` : d >= 1 ? `${d} j ${h % 24} h` : h >= 1 ? `${h} h ${pad(m % 60)}` : `${Math.max(m, 1)} min`;
  return { st: ms < 0 ? 'late' : ms < DAY ? 'hot' : ms < 3 * DAY ? 'soon' : 'ok', txt: (ms < 0 ? 'En retard de ' : 'Reste ') + t };
}
function dueTag(x) {
  if (!x.due) return '';
  const lab = dlab(x.due, x.dueT);
  if (x.done) return `<span class="tg due done" data-id="${x.id}">📅 ${lab} · ${(x.doneAt || 0) <= dl(x) ? '✅ dans les temps' : '⏱ terminée en retard'}</span>`;
  const r = remain(dl(x));
  return `<span class="tg due ${r.st}" data-id="${x.id}" title="Échéance : ${lab}">${r.st === 'late' ? '🔥' : '⏳'} ${r.txt} <small>· ${lab}</small></span>`;
}
/* Le temps restant se met à jour tout seul, sans recharger la liste */
setInterval(() => {
  document.querySelectorAll('#list .due:not(.done)').forEach(el => { const x = S.quests.find(v => v.id === el.dataset.id); if (x) el.outerHTML = dueTag(x); });
  dlbl();
}, 30000);

/* ----- Calendrier (sélecteur d'échéance du formulaire) ----- */
let selDate = '', selTime = '', calM = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function dlbl() {
  $('dbtn').classList.toggle('set', !!selDate);
  $('dlbl').textContent = selDate ? dlab(selDate, selTime, true) : 'Ajouter une échéance';
  const r = selDate ? remain(dl({ due: selDate, dueT: selTime })) : null;
  $('cr').hidden = !r;
  if (r) { $('cr').className = 'cal-r ' + r.st; $('cr').textContent = '⏳ ' + r.txt; }
}
function calDraw() {
  const y = calM.getFullYear(), m = calM.getMonth(), today = ymd(new Date());
  const start = new Date(y, m, 1 - (new Date(y, m, 1).getDay() + 6) % 7);      // semaine commençant le lundi
  const has = new Set(S.quests.filter(x => !x.del && !x.done && x.due).map(x => x.due));  // jours qui ont déjà une quête
  let h = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = ymd(d);
    h += `<button type="button" class="dy${d.getMonth() !== m ? ' o' : ''}${k === today ? ' td' : ''}${k === selDate ? ' sel' : ''}${has.has(k) ? ' has' : ''}" data-k="${k}">${d.getDate()}</button>`;
  }
  $('cm').textContent = calM.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  $('cg').innerHTML = h;
}
function calOpen(open) {
  $('cal').hidden = !open; $('dbtn').setAttribute('aria-expanded', open);
  if (open) { const b = selDate ? new Date(selDate + 'T12:00') : new Date(); calM = new Date(b.getFullYear(), b.getMonth(), 1); calDraw(); }
}
const goDate = d => { selDate = ymd(d); calM = new Date(d.getFullYear(), d.getMonth(), 1); calDraw(); dlbl(); };

$('dbtn').onclick = () => calOpen($('cal').hidden);
$('cp').onclick = () => { calM = new Date(calM.getFullYear(), calM.getMonth() - 1, 1); calDraw(); };
$('cn').onclick = () => { calM = new Date(calM.getFullYear(), calM.getMonth() + 1, 1); calDraw(); };
$('cg').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) goDate(new Date(b.dataset.k + 'T12:00')); });
$('cal').addEventListener('click', e => {
  const c = e.target.closest('[data-d]'); if (!c) return;
  const d = new Date(); d.setDate(d.getDate() + +c.dataset.d); goDate(d);
});
$('ct').oninput = e => { selTime = e.target.value; dlbl(); };
$('cc').onclick = () => { selDate = selTime = ''; $('ct').value = ''; calDraw(); dlbl(); };
$('co').onclick = () => calOpen(false);
document.addEventListener('click', e => { if (!$('cal').hidden && !e.composedPath().some(n => n.id === 'cal' || n.id === 'dbtn')) calOpen(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('cal').hidden) { calOpen(false); $('dbtn').focus(); } });

/* ==========================================================
   DÉMARRAGE
   ========================================================== */
if (S.theme === 'dungeon' || S.theme === 'synth') S.theme = 'city';                 // l'ancien thème Donjon est devenu Ville de nuit
if (S.theme) document.documentElement.dataset.theme = S.theme;
theme(); sndBtn(); buildPicker(); render(); initMusic();
