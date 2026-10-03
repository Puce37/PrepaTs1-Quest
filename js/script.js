'use strict';

/* ==========================================================
   CONFIGURATION
   Les trophées sont les images du dossier /images.
   Pour changer un chemin ou une extension, modifie "img".
   "fb" = emoji de secours si l'image est introuvable.
   ========================================================== */
const KEY = 'questlog.v1';
/* Progression : passer du niveau N au niveau N+1 demande 100 × N XP
   (niveau 1 → 100 XP, niveau 2 → 200 XP, niveau 3 → 300 XP…) */
const XP_MULT = 100;
const lvlStart = L => XP_MULT * L * (L - 1) / 2;        // XP cumulée pour ATTEINDRE le niveau L
const lvlNeed = L => XP_MULT * L;                       // XP à gagner pendant le niveau L
function lvlOf(xp) {
  let L = Math.max(1, Math.floor((1 + Math.sqrt(1 + 8 * xp / XP_MULT)) / 2));
  while (lvlStart(L + 1) <= xp) L++;
  while (L > 1 && lvlStart(L) > xp) L--;
  return L;
}
const RANKS = ['Noob', 'Pro', 'Hacker', 'Master', 'Legend', 'God'];

/* Musiques fournies avec l'appli : place tes MP3 dans /music puis liste-les ici.
   (Tu peux aussi en ajouter depuis le lecteur avec le bouton « Ajouter des MP3 ».) */
const PLAYLIST = [
  // { title: 'Mon morceau', src: 'music/mon-morceau.mp3' },
  { title: 'Son of Flynn', src: 'music/The Son of Flynn (From TRON LegacyScore).mp3' },
  { title: 'Digital Love', src: 'music/Daft Punk - Digital Love (Official Audio).mp3' },
  { title: 'Golden Brown', src: 'music/The Stranglers - Golden Brown.mp3' },
  { title: 'Shooting Stars', src: 'music/Bag Raiders - Shooting Stars (Official Video).mp3' },
];

const CAT = {
  main: ['🔥', 'Principale'],
  side: ['📜', 'Secondaire'],
  opt:  ['💡', 'Facultative'],
  urg:  ['🚨', 'Urgente']
};

const DIF = {
  easy: { label: 'Facile',    xp: 25,  color: '#cd7f32', trophy: 'Bronze',  img: 'images/bronze.png',  fb: '🥉' },
  mid:  { label: 'Moyen',   xp: 50,  color: '#c9d2de', trophy: 'Argent',  img: 'images/argent.png',  fb: '🥈' },
  hard: { label: 'Difficile', xp: 100, color: '#ffc83d', trophy: 'Or',      img: 'images/or.png',      fb: '🥇' },
  epic: { label: 'Extrême',    xp: 250, color: '#72dcff', trophy: 'Platine', img: 'images/platine.png', fb: '💎' }
};

/* ==========================================================
   ÉTAT + SAUVEGARDE (LocalStorage)
   ========================================================== */
let S = { quests: [], base: 0, theme: '', sound: true, vol: .5, track: -1, mp: false, fx: true };
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
   Sons doux et organiques : sinus + harmoniques, attaque courte,
   déclin naturel, petite réverbération, bruit filtré pour les « souffles ».
   ========================================================== */
let ac, master, verb;
function audio() {
  if (ac) return ac;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = .9;
  const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
  const len = Math.floor(ac.sampleRate * 1.6), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
  verb = ac.createConvolver(); verb.buffer = buf;
  const vg = ac.createGain(); vg.gain.value = .35; verb.connect(vg); vg.connect(master);
  return ac;
}
function partial(f, t, d, v, wet) {                    // une composante sinusoïdale avec enveloppe
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = f;
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(master);
  if (wet) { const s = ac.createGain(); s.gain.value = wet; g.connect(s); s.connect(verb); }
  o.start(t); o.stop(t + d + .05);
}
const pluck = (f, t, d = .45, v = .2) => [[1, 1], [2, .25], [3, .08]].forEach(([m, a]) => partial(f * m, t, d / Math.sqrt(m), v * a, .45));
const bell = (f, t, d, v = .16) => [[1, 1, 1], [2.76, .32, .55], [5.4, .12, .3]].forEach(([m, a, k]) => partial(f * m, t, d * k, v * a, .7));
function swoosh(t, d, f0, f1, v = .16) {               // souffle : bruit passe-bande qui glisse
  const n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + d * .25); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t);
}
function snd(k) {
  if (!S.sound) return;
  try {
    audio(); ac.resume(); const t = ac.currentTime + .01;
    if (k === 'add')  { pluck(659, t, .5); pluck(988, t + .09, .6, .16); }                       // « bulle » douce montante
    if (k === 'done') { [523, 659, 784, 1047].forEach((f, i) => bell(f, t + i * .085, 1.4 - i * .1)); bell(2093, t + .34, 1.2, .05); }   // petit carillon
    if (k === 'del')  { swoosh(t, .28, 1800, 280, .14); pluck(196, t + .02, .35, .16); }         // souffle + toc sourd
    if (k === 'lvl')  { [392, 494, 587, 784].forEach((f, i) => pluck(f, t + i * .1, 1.1, .18)); bell(1175, t + .45, 2, .14); bell(1568, t + .55, 2, .1); }
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
/* Photo du compte Google dans le cercle (appelée par drive.js) ; sinon silhouette */
function setAvatar(url) {
  const lv = $('lv');
  if (url) {
    if (lv.dataset.src !== url) { lv.dataset.src = url; lv.innerHTML = `<img class="lvp" src="${esc(url)}" alt="" referrerpolicy="no-referrer" data-fb="👤">`; }
  } else { delete lv.dataset.src; lv.innerHTML = '<span class="lvp">👤</span>'; }
}
function head() {
  const xp = xpTotal(), lvl = lvlOf(xp), need = lvlNeed(lvl), p = xp - lvlStart(lvl);
  const vis = S.quests.filter(x => !x.del), tot = vis.length, dn = vis.filter(x => x.done).length;
  $('lvn').textContent = lvl;
  $('rank').textContent = RANKS[Math.min(Math.floor((lvl - 1) / 3), RANKS.length - 1)];
  $('xpt').textContent = `· ${p} / ${need} XP (total ${xp})`;
  $('bar').style.width = (p / need * 100) + '%';
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
    return `<article class="q${x.id === fresh ? ' new' : ''}${x.done ? ' done' : ''}" data-id="${x.id}" data-dif="${x.dif}" style="--c:${d.color}">
  <button class="chk" data-act="ok" aria-label="${x.done ? 'Rouvrir la quête' : 'Valider la quête'}">${x.done ? '✓' : ''}</button>
  <div class="bd">
    <h3>${esc(x.title)}</h3>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}
    <div class="tags">
      <span class="tg${x.cat === 'urg' && !x.done ? ' pulse' : ''}">${c[0]} ${c[1]}</span>
      <span class="tg" style="color:color-mix(in srgb,${d.color} 62%,var(--tx))">${trophy(x.dif, 'tro')} ${d.label} · +${d.xp} XP</span>
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
  selDate = selTime = ''; $('ct').value = ''; dlbl(); qToggle(false);
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
    const d = DIF[x.dif], r = b.getBoundingClientRect(), oldL = lvlOf(xpTotal());
    el.classList.add('leave');
    burst(r.left + 13, r.top + 13, d.color, '+' + d.xp + ' XP');
    x.done = true; x.doneAt = x.upd = Date.now();
    save(); snd('done'); head();
    const nl = lvlOf(xpTotal());
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

/* Paramètres : effets sonores + animations d'ambiance */
function sndBtn() { $('sfx').checked = S.sound; $('fxo').checked = S.fx !== false; document.documentElement.classList.toggle('nofx', S.fx === false); }
$('sfx').onchange = e => { S.sound = e.target.checked; save(); if (S.sound) snd('add'); };
$('fxo').onchange = e => { S.fx = e.target.checked; save(); sndBtn(); };

/* ==========================================================
   AMBIANCE DES THÈMES
   #fx = décor derrière les cartes · #fx2 = particules devant (feuilles, pluie)
   ========================================================== */
const rnd = (a, b) => a + Math.random() * (b - a);
const f1 = (a, b) => rnd(a, b).toFixed(1);
const NP = ['#ffd98a', '#ffb3e6', '#b9a0ff', '#8fe3ff'];

/* Skyline SVG : immeubles + fenêtres allumées */
function skyline(fill, hMin, hMax, litP, op, pal, cls = '', stroke = '') {
  const W = 1600; let x = -10, s = '';
  while (x < W) {
    const bw = Math.round(rnd(38, 100)), bh = Math.round(rnd(hMin, hMax)), y = 300 - bh;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1.3"` : ''}/>`;
    if (bh > hMax * .85) s += `<rect x="${x + bw / 2 - 1}" y="${y - 24}" width="2" height="24" fill="${fill}"/><circle class="bl" cx="${x + bw / 2}" cy="${y - 25}" r="2.4" fill="#ff4d6d" style="animation-delay:-${f1(0, 3)}s"/>`;
    for (let wx = x + 7; wx < x + bw - 8; wx += 13)
      for (let wy = y + 10; wy < 290; wy += 16)
        if (Math.random() < litP)
          s += `<rect${Math.random() < .07 ? ` class="tw" style="animation-delay:-${f1(0, 4)}s"` : ''} x="${wx}" y="${wy}" width="5" height="7" fill="${pal[Math.floor(rnd(0, pal.length))]}" opacity="${op}"/>`;
    x += bw + Math.round(rnd(0, 6));
  }
  return `<svg class="sk ${cls}" viewBox="0 0 ${W} 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${s}</svg>`;
}

/* Arbres en silhouette : sapins (3 étages) et feuillus, sur un plan de profondeur */
function trees(fill, trunk, n, hMin, hMax, op) {
  n = Math.round(n * (innerWidth < 700 ? 2.2 : 1));
  let s = ''; const b = 400;
  for (let i = 0; i < n; i++) {
    const x = rnd(0, 1600), h = rnd(hMin, hMax), w = h * .28;
    if (Math.random() < .6) {
      s += `<rect x="${x - 3}" y="${b - h * .18}" width="6" height="${h * .18}" fill="${trunk}"/>`;
      for (let k = 0; k < 3; k++) {
        const yk = b - h * .14 - k * h * .22, th = h * .46 * (1 - k * .12), tw = w * (1 - k * .24);
        s += `<polygon points="${x.toFixed(0)},${(yk - th).toFixed(0)} ${(x - tw).toFixed(0)},${yk.toFixed(0)} ${(x + tw).toFixed(0)},${yk.toFixed(0)}" fill="${fill}"/>`;
      }
    } else {
      s += `<rect x="${x - 4}" y="${b - h * .4}" width="8" height="${h * .4}" fill="${trunk}"/><ellipse cx="${x.toFixed(0)}" cy="${(b - h * .62).toFixed(0)}" rx="${(h * .3).toFixed(0)}" ry="${(h * .34).toFixed(0)}" fill="${fill}"/><ellipse cx="${(x - w * .6).toFixed(0)}" cy="${(b - h * .5).toFixed(0)}" rx="${(h * .2).toFixed(0)}" ry="${(h * .2).toFixed(0)}" fill="${fill}"/>`;
    }
  }
  return `<svg class="fo" style="opacity:${op};animation-delay:-${f1(0, 8)}s" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${s}</svg>`;
}

const rain = n => { let h = ''; for (let i = 0; i < n; i++) h += `<i class="drop" style="left:${f1(-5, 105)}%;height:${Math.round(rnd(16, 34))}px;opacity:${rnd(.25, .6).toFixed(2)};animation-duration:${rnd(.45, .9).toFixed(2)}s;animation-delay:-${rnd(0, 1).toFixed(2)}s"></i>`; return h; };

function tronHTML() {
  let w = '';
  const cx = Math.round(innerWidth * 1.1 / 64) * 64;   // centre du sol, aligné sur la grille
  for (let i = 0; i < 6; i++) {                        // murs de lumière qui traversent, posés sur les lignes de la grille
    const col = i % 2 ? '#ff7a1a' : '#00e5ff';
    w += `<i class="lw h" style="--tc:${col};top:${64 * Math.round(rnd(20, 31))}px;animation-duration:${f1(5, 11)}s;animation-delay:-${f1(0, 11)}s"></i>`;
  }
  for (let i = 0; i < 6; i++) {                        // murs qui foncent vers nous ou s'éloignent
    const col = i % 2 ? '#00e5ff' : '#ff7a1a';
    w += `<i class="lw v" style="--tc:${col};left:${cx + 64 * Math.round(rnd(-12, 12))}px;animation-duration:${f1(3.5, 7)}s;animation-delay:-${f1(0, 7)}s${i % 2 ? ';animation-direction:reverse' : ''}"></i>`;
  }
  return '<i class="tdisc"></i>' + skyline('#02101c', 70, 170, .2, .9, ['#00e5ff', '#7df9ff', '#ff7a1a'], 'th', 'rgba(0,229,255,.55)')
    + `<div class="tfloor"><div class="tpl"><div class="tgrid">${w}</div></div></div><i class="thz"></i>`;
}
function forestHTML() {
  let h = '';
  for (let i = 0; i < 3; i++) h += `<i class="ray" style="left:${f1(5, 85)}%;animation-delay:-${f1(0, 7)}s;animation-duration:${f1(5, 9)}s"></i>`;
  return h + trees('#1f6b45', '#2d3b22', 9, 150, 300, .5) + trees('#14492f', '#241a12', 8, 190, 360, .8) + trees('#0a2c1c', '#150f0a', 6, 230, 390, 1);
}
function leavesHTML() {
  let h = '';
  for (let i = 0; i < 26; i++)
    h += `<i class="leaf" style="left:${f1(0, 100)}%;--s:${f1(8, 17)}px;--dx:${Math.round(rnd(-70, 70))}px;--lc:hsl(${Math.round(rnd(70, 130))},60%,${Math.round(rnd(38, 62))}%);animation-duration:${f1(9, 18)}s;animation-delay:-${f1(0, 18)}s"></i>`;
  return h;
}
function cityHTML(day) {
  if (day) {
    const win = ['#fffbe6', '#ffffff', '#d6ecff', '#bfe0ff'];
    let s = '<div class="sun"></div>', cars = '';
    for (let i = 0; i < 6; i++) s += `<i class="cloud" style="top:${f1(4, 34)}%;--w:${Math.round(rnd(90, 190))}px;opacity:${rnd(.6, .95).toFixed(2)};animation-duration:${Math.round(rnd(60, 120))}s;animation-delay:-${Math.round(rnd(0, 120))}s"></i>`;
    for (let i = 0; i < 3; i++) s += `<i class="bird" style="top:${f1(10, 38)}%;animation-duration:${Math.round(rnd(14, 24))}s;animation-delay:-${Math.round(rnd(0, 20))}s"></i>`;
    ['#e34a4a', '#f2c230', '#ffffff', '#3a78e0', '#2a2f3d'].forEach((c, i) => cars += `<i class="car${i % 2 ? ' rv' : ''}" style="--cc:${c};bottom:${i % 2 ? 9 : 3}px;animation-duration:${f1(9, 17)}s;animation-delay:-${f1(0, 16)}s"></i>`);
    return s + skyline('#a9c5e8', 110, 230, .3, .6, win) + skyline('#6f90bd', 60, 170, .34, .85, win) + '<i class="road"></i>' + cars;
  }
  let stars = '';
  for (let i = 0; i < 46; i++)
    stars += `<i class="star" style="left:${f1(0, 100)}%;top:${f1(0, 55)}%;--s:${f1(1, 2.6)}px;animation-duration:${f1(2, 5)}s;animation-delay:-${f1(0, 5)}s"></i>`;
  return stars + '<div class="moon"></div><i class="haze"></i><i class="shoot"></i>' + skyline('#2b1a55', 120, 240, .17, .55, NP) + skyline('#150c2e', 60, 170, .24, 1, NP);
}
function dungeonHTML() {
  const torch = (side, top) => {
    let e = '';
    for (let i = 0; i < 7; i++) e += `<u class="ember" style="--x:${Math.round(rnd(-22, 22))}px;animation-duration:${f1(1.8, 3.4)}s;animation-delay:-${f1(0, 3)}s"></u>`;
    return `<div class="torch ${side}" style="top:${top}%"><i class="tgl"></i><div class="flame"><i></i></div><b></b>${e}</div>`;
  };
  return '<b class="beam"></b><b class="post l"></b><b class="post r"></b>' + torch('l', 22) + torch('r', 22) + torch('l', 64) + torch('r', 64);
}
function stormHTML() {
  const bolt = (x, dur, del) => {
    let px = 45, py = 0, pts = '45,0';
    while (py < 360) { py += rnd(22, 44); px += rnd(-20, 20); pts += ` ${px.toFixed(0)},${py.toFixed(0)}`; }
    const st = `animation-duration:${dur}s;animation-delay:-${del.toFixed(1)}s`;
    return `<i class="flash" style="--fx:${x.toFixed(0)}%;${st}"></i><svg class="bolt" style="left:${x.toFixed(0)}%;${st}" viewBox="0 0 90 400" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
  };
  const tree = '<svg class="tree" viewBox="0 0 200 270" aria-hidden="true"><g fill="#03050a" stroke="#03050a"><path d="M92 270 C96 215 90 185 84 150 L118 150 C112 185 106 215 110 270 Z" stroke="none"/><path d="M100 175 L62 128 M104 168 L146 120 M100 150 L98 100" stroke-width="7" fill="none" stroke-linecap="round"/><g stroke="none"><circle cx="100" cy="92" r="46"/><circle cx="62" cy="120" r="32"/><circle cx="140" cy="118" r="34"/><circle cx="82" cy="62" r="28"/><circle cx="124" cy="58" r="28"/><circle cx="48" cy="96" r="22"/></g></g></svg>';
  return '<i class="cl"></i><i class="cl c2"></i>' + bolt(rnd(12, 40), 8.3, rnd(0, 8)) + bolt(rnd(55, 88), 12.7, rnd(0, 12)) + trees('#0b1424', '#0b1424', 28, 100, 240, .9) + trees('#070d18', '#070d18', 20, 130, 280, .95) + bareTrees('#04070d', 9, 150, 330, 1) + trees('#04070d', '#04070d', 14, 150, 310, 1) + '<div class="hill"></div>' + tree;
}
function roomsHTML() {
  let p = '';
  for (let i = 0; i < 7; i++) p += `<i class="pan" style="animation-duration:${f1(3, 11)}s;animation-delay:-${f1(0, 9)}s"></i>`;
  return `<div class="ceil">${p}</div><i class="hum"></i><i class="grain"></i>`;
}
/* La moto est dans le calque AVANT (#fx2) pour rester nette, même derrière des cartes floutées */
function motoBike() {
  const wheel = cx => `<g class="wh"><circle cx="${cx}" cy="68" r="20" fill="#08080f" stroke="#8d93d6" stroke-width="3"/><path d="M${cx} 50V86M${cx - 18} 68H${cx + 18}M${cx - 13} 55L${cx + 13} 81M${cx + 13} 55L${cx - 13} 81" stroke="#4a4f8a" stroke-width="1.5"/></g>`;
  return `<div class="moto"><i class="hl"></i><i class="tl2"></i><svg viewBox="0 0 160 92" aria-hidden="true">
<ellipse cx="82" cy="89" rx="68" ry="3.5" style="fill:var(--ac)" opacity=".35"/>
${wheel(36)}${wheel(126)}
<path d="M36 68 L52 36" stroke="#1b1d33" stroke-width="5" stroke-linecap="round"/><path d="M48 34 L58 31" stroke="#1b1d33" stroke-width="4" stroke-linecap="round"/>
<path d="M84 66 L126 68" stroke="#1b1d33" stroke-width="5" stroke-linecap="round"/><path d="M70 71 L124 75" stroke="#2a2d55" stroke-width="3" stroke-linecap="round"/>
<path d="M56 58 L74 48 L110 48 L122 60 L116 72 L70 72 Z" fill="#10111e" stroke="#33386a" stroke-width="1.5"/>
<path d="M60 46 Q76 28 100 40 L104 48 L64 50 Z" fill="#1a1c36" style="stroke:var(--ac)" stroke-width="1.6"/>
<path d="M52 40 L62 27 L68 30 L60 44 Z" fill="#14162b" style="stroke:var(--ac2)" stroke-width="1"/>
<path d="M100 40 L128 38 L134 46 L104 48 Z" fill="#0b0c16"/>
<path d="M108 42 L96 56 L88 66" stroke="#0f1020" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M106 42 L112 34 L84 16 L74 22 Z" fill="#0f1020"/>
<path d="M82 20 L66 28 L56 32" stroke="#10111e" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="76" cy="10" r="9" fill="#0b0c16" style="stroke:var(--ac2)" stroke-width="1.5"/>
<circle class="hlb" cx="46" cy="40" r="4" fill="#fff6c8"/><rect class="tlb" x="132" y="40" width="5" height="3" fill="#ff2a4a"/></svg></div>`;
}
function motoHTML() {
  const cols = ['#ff4fa3', '#35d0ff', '#ffd166', '#b388ff'], base = 'max(12vh,70px)';
  let bk = '';
  for (let i = 0; i < 14; i++) bk += `<i class="bk" style="left:${f1(0, 100)}%;bottom:${f1(30, 70)}%;width:${Math.round(rnd(6, 16))}px;height:${Math.round(rnd(6, 16))}px;background:${cols[i % 4]};opacity:.5;animation-duration:${f1(3, 6)}s;animation-delay:-${f1(0, 5)}s"></i>`;
  /* chaque couche = 2 copies côte à côte qui défilent en boucle ; plus la couche est lointaine, plus elle est lente */
  const layer = (inner, dur) => `<div class="sc" style="bottom:${base};animation-duration:${dur}s"><div class="scp">${inner}</div><div class="scp">${inner}</div></div>`;
  return layer(skyline('#0d0b20', 130, 240, .14, .55, cols), 120) + layer(skyline('#14122b', 90, 200, .22, .8, cols), 60) + layer(bk, 40)
    + '<i class="lamps"></i><div class="mroad"><i class="dash"></i></div>';
}
const speedLines = () => { let h = ''; for (let i = 0; i < 9; i++) h += `<i class="spd" style="top:${f1(45, 96)}%;width:${Math.round(rnd(120, 260))}px;animation-duration:${f1(.5, 1.2)}s;animation-delay:-${f1(0, 1.2)}s"></i>`; return h; };

/* Arbres morts : branches récursives */
function bareTrees(fill, n, hMin, hMax, op) {
  n = Math.round(n * (innerWidth < 700 ? 2.2 : 1));
  const br = (x, y, len, ang, w, d) => {
    if (d === 0) return '';
    const x2 = x + len * Math.sin(ang), y2 = y - len * Math.cos(ang);
    return `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke-width="${w.toFixed(1)}"/>` + br(x2, y2, len * rnd(.66, .8), ang - rnd(.3, .7), w * .72, d - 1) + br(x2, y2, len * rnd(.66, .8), ang + rnd(.3, .7), w * .72, d - 1);
  };
  let s = '';
  for (let i = 0; i < n; i++) s += br(rnd(0, 1600), 400, rnd(hMin, hMax) * .3, rnd(-.15, .15), rnd(5, 8), 6);
  return `<svg class="fo" style="opacity:${op};animation-delay:-${f1(0, 8)}s" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g stroke="${fill}" stroke-linecap="round">${s}</g></svg>`;
}

/* Galaxie : nébuleuses, étoiles, galaxies spirales qui tournent, planètes qui flottent */
function spiral(uid, h1, h2, arms, turns) {
  let s = `<defs><radialGradient id="${uid}"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="hsl(${h1},95%,82%)" stop-opacity=".85"/><stop offset="1" stop-color="hsl(${h1},90%,60%)" stop-opacity="0"/></radialGradient><filter id="${uid}b"><feGaussianBlur stdDeviation="1.3"/></filter></defs><g filter="url(#${uid}b)"><circle cx="100" cy="100" r="36" fill="url(#${uid})"/>`;
  for (let a = 0; a < arms; a++) for (let i = 0; i < 150; i++) {
    const t = i / 150, r = 8 + t * 90, th = a * 6.283 / arms + t * turns + rnd(-.2, .2) * (1 - t * .4);
    s += `<circle cx="${(100 + r * Math.cos(th) + rnd(-4, 4) * t).toFixed(1)}" cy="${(100 + r * Math.sin(th) + rnd(-4, 4) * t).toFixed(1)}" r="${f1(.6, 2.2)}" fill="hsl(${Math.round(h1 + (h2 - h1) * t)},90%,${Math.round(82 - t * 22)}%)" opacity="${(.95 - t * .55).toFixed(2)}"/>`;
  }
  return s + '</g>';
}
function galaxyHTML() {
  let h = '<i class="neb" style="left:-10%;top:5%;width:55vw;height:40vh;background:rgba(120,70,255,.35)"></i><i class="neb" style="right:-10%;top:45%;width:50vw;height:45vh;background:rgba(0,190,255,.25);animation-delay:-20s"></i><i class="neb" style="left:25%;bottom:-10%;width:60vw;height:35vh;background:rgba(255,80,190,.2);animation-delay:-40s"></i>';
  for (let i = 0; i < 90; i++) h += `<i class="star${i % 14 === 0 ? ' big' : ''}" style="left:${f1(0, 100)}%;top:${f1(0, 100)}%;--s:${f1(1, 2.8)}px;animation-duration:${f1(2, 6)}s;animation-delay:-${f1(0, 6)}s"></i>`;
  const gal = (l, t, w, rot, h1, h2, arms, turns, dur, uid) => `<div class="galw" style="left:${l}%;top:${t}%;width:${w}px;transform:rotate(${rot}deg) scaleY(.46)"><svg class="gal" style="animation-duration:${dur}s" viewBox="0 0 200 200" aria-hidden="true">${spiral(uid, h1, h2, arms, turns)}</svg></div>`;
  h += gal(62, 8, 300, -22, 270, 200, 2, 5.2, 140, 'ga') + gal(4, 48, 220, 18, 190, 320, 3, 4.2, 180, 'gb') + gal(40, 74, 130, -8, 40, 20, 2, 4.8, 220, 'gc');
  const PL = [   // gauche %, haut %, taille px, texture, lueur, durée du flottement, option
    [5, 14, 130, 'repeating-linear-gradient(172deg,rgba(255,255,255,.08) 0 7px,transparent 7px 16px),radial-gradient(circle at 32% 30%,#ffe7b0,#e9a24e 45%,#8f4b1d 100%)', 'rgba(255,190,110,.35)', 11, 'ring'],
    [84, 52, 96, 'repeating-linear-gradient(180deg,rgba(255,255,255,.1) 0 5px,transparent 5px 12px),radial-gradient(circle at 32% 30%,#9ad4ff,#3f77e0 50%,#16296b 100%)', 'rgba(90,150,255,.4)', 13, ''],
    [14, 74, 64, 'radial-gradient(circle at 32% 30%,#c9f5d4,#3fb089 45%,#0f4a52 100%)', 'rgba(80,220,170,.35)', 9, 'moon'],
    [76, 12, 38, 'radial-gradient(circle at 32% 30%,#ffb3a0,#d9503c 50%,#5a1410 100%)', 'rgba(255,100,80,.35)', 8, '']
  ];
  h += PL.map(([l, t, s, bg, g, d, ex]) => `<div class="pl" style="left:${l}%;top:${t}%;width:${s}px;height:${s}px;animation-duration:${d}s">${ex === 'ring' ? '<i class="ring b"></i>' : ''}<i class="sph" style="background:${bg};box-shadow:inset -${Math.round(s * .11)}px -${Math.round(s * .08)}px ${Math.round(s * .22)}px rgba(0,0,0,.65),0 0 ${Math.round(s * .28)}px ${g}"></i>${ex === 'ring' ? '<i class="ring f"></i>' : ''}${ex === 'moon' ? '<div class="orb"><i></i></div>' : ''}</div>`).join('');
  return h + '<i class="shoot" style="top:14%;left:60%;animation-delay:2s"></i><i class="shoot" style="top:40%;left:90%;animation-duration:14s;animation-delay:8s"></i>';
}

function fx(t) {
  const B = { tron: tronHTML, forest: forestHTML, city: () => cityHTML(false), day: () => cityHTML(true), dungeon: dungeonHTML, storm: stormHTML, rooms: roomsHTML, moto: motoHTML, galaxy: galaxyHTML }[t];
  const R = { forest: leavesHTML, storm: () => rain(70), moto: () => rain(60) + speedLines() + motoBike() }[t];
  $('fx').className = 'th-' + t; $('fx2').className = 'th-' + t;   // préfixe : évite tout conflit avec les classes du décor
  $('fx').innerHTML = B ? B() : '';
  $('fx2').innerHTML = R ? R() : '';
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
  $('mus').classList.toggle('live', !au.paused);
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
  au.volume = S.vol; $('vol').value = S.vol; fill($('vol'));
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
   MENUS DÉROULANTS (thèmes, musique, paramètres) + CRÉATION DE QUÊTE
   ========================================================== */
const DDS = ['themes', 'mp', 'set'];
function ddClose(except) {
  DDS.forEach(id => {
    if (id === except) return;
    $(id).hidden = true;
    const b = document.querySelector(`[data-dd="${id}"]`); b.classList.remove('on'); b.setAttribute('aria-expanded', 'false');
  });
}
document.querySelectorAll('[data-dd]').forEach(b => b.addEventListener('click', () => {
  const p = $(b.dataset.dd), open = p.hidden;
  ddClose(open ? p.id : ''); p.hidden = !open; b.classList.toggle('on', open); b.setAttribute('aria-expanded', open);
}));
/* composedPath : fiable même si le contenu du menu est redessiné pendant le clic */
document.addEventListener('click', e => { if (!e.composedPath().some(n => n.nodeType === 1 && (n.classList.contains('dd') || n.dataset.dd))) ddClose(''); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') ddClose(''); });

function qToggle(open) {
  const o = open === undefined ? !$('qa').classList.contains('open') : open;
  $('qa').classList.toggle('open', o); $('qc').classList.toggle('open', o); $('new').setAttribute('aria-expanded', o);
  if (o) setTimeout(() => { if ($('qa').classList.contains('open')) { $('qa').classList.add('settled'); $('t').focus({ preventScroll: true }); } }, 380);
  else { $('qa').classList.remove('settled'); calOpen(false); }
}
$('new').onclick = () => qToggle();

/* ==========================================================
   DÉMARRAGE
   ========================================================== */
if (S.theme === 'synth') S.theme = 'city';                 // l'ancien thème Donjon est devenu Ville de nuit
if (S.theme) document.documentElement.dataset.theme = S.theme;
theme(); sndBtn(); buildPicker(); render(); initMusic();
