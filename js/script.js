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
let S = { quests: [], xp: 0, theme: '', sound: true };
let view = 'todo', cat = 'all', q = '', fresh = '', selDif = 'mid';

try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

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
  const lvl = Math.floor(S.xp / XP_PAR_NIVEAU) + 1, p = S.xp % XP_PAR_NIVEAU;
  const tot = S.quests.length, dn = S.quests.filter(x => x.done).length;
  $('lv').textContent = lvl;
  $('rank').textContent = RANKS[Math.min(Math.floor((lvl - 1) / 3), RANKS.length - 1)];
  $('xpt').textContent = `· ${p} / ${XP_PAR_NIVEAU} XP (total ${S.xp})`;
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
    .filter(x => x.done === (view === 'done') && (cat === 'all' || x.cat === cat) && (x.title + ' ' + x.desc).toLowerCase().includes(q))
    .sort((a, b) => view === 'done'
      ? (b.doneAt || 0) - (a.doneAt || 0)
      : ((b.cat === 'urg') - (a.cat === 'urg')) || b.at - a.at);

  $('list').innerHTML = list.length ? list.map(x => {
    const d = DIF[x.dif], c = CAT[x.cat];
    return `<article class="q${x.id === fresh ? ' new' : ''}${x.done ? ' done' : ''}" data-id="${x.id}" style="--c:${d.color}">
  <button class="chk" data-act="ok" aria-label="${x.done ? 'Rouvrir la quête' : 'Valider la quête'}">${x.done ? '✓' : ''}</button>
  <div class="bd">
    <h3>${esc(x.title)}</h3>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}
    <div class="tags">
      <span class="tg${x.cat === 'urg' && !x.done ? ' pulse' : ''}">${c[0]} ${c[1]}</span>
      <span class="tg" style="color:${d.color}">${trophy(x.dif, 'tro')} ${d.label} · +${d.xp} XP</span>
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
  const x = { id: Date.now() + '-' + Math.floor(Math.random() * 999), title: t, cat: $('c').value, dif: selDif, desc: $('ds').value.trim(), done: false, at: Date.now() };
  S.quests.unshift(x);
  fresh = x.id; view = 'todo'; cat = 'all'; q = ''; $('q').value = '';
  $('t').value = ''; $('ds').value = '';
  save(); snd('add'); render();
});

$('list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const el = b.closest('.q');
  if (el.classList.contains('leave') || el.classList.contains('gone')) return;
  const x = S.quests.find(v => v.id === el.dataset.id); if (!x) return;

  if (b.dataset.act === 'del') {                       // Suppression
    el.classList.add('gone');
    S.quests = S.quests.filter(v => v !== x);
    save(); snd('del'); setTimeout(render, 300);

  } else if (!x.done) {                                // Validation
    const d = DIF[x.dif], r = b.getBoundingClientRect(), oldL = Math.floor(S.xp / XP_PAR_NIVEAU) + 1;
    el.classList.add('leave');
    burst(r.left + 13, r.top + 13, d.color, '+' + d.xp + ' XP');
    S.xp += d.xp; x.done = true; x.doneAt = Date.now();
    save(); snd('done'); head();
    const nl = Math.floor(S.xp / XP_PAR_NIVEAU) + 1;
    if (nl > oldL) setTimeout(() => {
      snd('lvl');
      const l = $('lv').getBoundingClientRect();
      burst(l.left + 29, l.top + 29, '#fbbf24', '⭐ Niveau ' + nl + ' !');
    }, 450);
    setTimeout(render, 380);

  } else {                                             // Retour « En cours »
    S.xp = Math.max(0, S.xp - DIF[x.dif].xp);
    x.done = false; delete x.doneAt; fresh = x.id;
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
}
$('themes').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { theme(b.dataset.t); save(); } });

function sndBtn() { $('snd').textContent = S.sound ? '🔊' : '🔇'; $('snd').classList.toggle('on', S.sound); }
$('snd').addEventListener('click', () => { S.sound = !S.sound; save(); sndBtn(); snd('add'); });

/* ==========================================================
   DÉMARRAGE
   ========================================================== */
if (S.theme) document.documentElement.dataset.theme = S.theme;
theme(); sndBtn(); buildPicker(); render();
