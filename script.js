/**
 * JOURNAL DE QUÊTES RPG - MOTEUR JAVASCRIPT
 */

// ==========================================
// 1. ÉTAT GLOBAL DE L'APPLICATION
// ==========================================
let quests = JSON.parse(localStorage.getItem('rpg_quests')) || [
  {
    id: '1',
    title: 'Explorer la première contrée',
    category: 'main',
    xp: 100,
    desc: 'Prenez en main le journal et personnalisez vos paramètres.',
    completed: true,
    createdAt: Date.now()
  },
  {
    id: '2',
    title: 'Créer votre propre quête',
    category: 'side',
    xp: 50,
    desc: 'Utilisez le formulaire à gauche pour ajouter un objectif.',
    completed: false,
    createdAt: Date.now() + 1
  }
];

let currentTheme = localStorage.getItem('rpg_theme') || 'dark-fantasy';
let currentStatusFilter = 'all';
let currentCategoryFilter = 'all';
let searchQuery = '';
let soundEnabled = localStorage.getItem('rpg_sound') !== 'false';

// ==========================================
// 2. SYNTHÉTISEUR SONORE (Web Audio API)
// ==========================================
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playComplete() {
    if (!soundEnabled) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Arpège triomphant (Do5 - Mi5 - Sol5 - Do6)
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.setValueAtTime(659.25, now + 0.08);
    osc1.frequency.setValueAtTime(783.99, now + 0.16);
    osc1.frequency.setValueAtTime(1046.50, now + 0.24);

    osc2.frequency.setValueAtTime(261.63, now);
    osc2.frequency.setValueAtTime(523.25, now + 0.24);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  playAdd() {
    if (!soundEnabled) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playDelete() {
    if (!soundEnabled) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.15);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }
}

const sfx = new SoundEffects();

// ==========================================
// 3. MOTEUR DE PARTICULES (FEUX D'ARTIFICE)
// ==========================================
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 3 + 2;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8 - 2;
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.015;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; // Gravité
    this.alpha -= this.decay;
  }
}

function spawnParticles(x, y) {
  const colors = ['#D4AF37', '#38EF7D', '#00F3FF', '#FF007F', '#FFFFFF'];
  for (let i = 0; i < 30; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    particles.push(new Particle(x, y, color));
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.alpha > 0);
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();

// ==========================================
// 4. RENDU & LOGIQUE DE QUÊTES
// ==========================================

function saveQuests() {
  localStorage.setItem('rpg_quests', JSON.stringify(quests));
}

function updateHUD() {
  const total = quests.length;
  const completed = quests.filter(q => q.completed).length;
  const totalXP = quests.filter(q => q.completed).reduce((sum, q) => sum + Number(q.xp), 0);

  // Calcul du Niveau (ex: 100 XP par niveau)
  const level = Math.floor(totalXP / 100) + 1;
  const currentLevelXP = totalXP % 100;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Mise à jour de l'UI
  document.getElementById('levelDisplay').textContent = `NIV. ${level}`;
  document.getElementById('xpText').textContent = `${currentLevelXP} / 100 XP`;
  document.getElementById('xpBarFill').style.width = `${currentLevelXP}%`;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statRate').textContent = `${rate}%`;
}

function renderQuests() {
  const questListEl = document.getElementById('questList');
  const emptyStateEl = document.getElementById('emptyState');

  // Filtrage
  const filtered = quests.filter(quest => {
    const matchesStatus = 
      currentStatusFilter === 'all' ? true :
      currentStatusFilter === 'completed' ? quest.completed : !quest.completed;

    const matchesCategory = 
      currentCategoryFilter === 'all' ? true : quest.category === currentCategoryFilter;

    const matchesSearch = 
      quest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quest.desc && quest.desc.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesCategory && matchesSearch;
  });

  questListEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyStateEl.classList.remove('hidden');
  } else {
    emptyStateEl.classList.add('hidden');

    filtered.forEach(quest => {
      const card = document.createElement('div');
      card.className = `quest-card ${quest.completed ? 'completed' : ''}`;

      const catBadges = {
        main: { label: '🔥 Principale', class: 'badge-main' },
        side: { label: '📜 Secondaire', class: 'badge-side' },
        dungeon: { label: '🏰 Donjon', class: 'badge-dungeon' },
        daily: { label: '⏳ Quotidienne', class: 'badge-daily' }
      };

      const badgeInfo = catBadges[quest.category] || catBadges.side;

      card.innerHTML = `
        <div class="quest-left">
          <div class="custom-checkbox" onclick="toggleQuest('${quest.id}', event)">
            ${quest.completed ? '<i data-lucide="check" style="width:16px;height:16px;"></i>' : ''}
          </div>
          <div class="quest-body">
            <div class="quest-header-meta">
              <span class="badge ${badgeInfo.class}">${badgeInfo.label}</span>
            </div>
            <div class="quest-title">${escapeHTML(quest.title)}</div>
            ${quest.desc ? `<div class="quest-desc">${escapeHTML(quest.desc)}</div>` : ''}
          </div>
        </div>
        <div class="quest-right">
          <span class="xp-badge">+${quest.xp} XP</span>
          <button class="btn-delete" onclick="deleteQuest('${quest.id}')" title="Supprimer la quête">
            <i data-lucide="trash-2" style="width:18px;height:18px;"></i>
          </button>
        </div>
      `;

      questListEl.appendChild(card);
    });
  }

  // Réinitialiser les icônes Lucide dynamiques
  if (window.lucide) lucide.createIcons();
  updateHUD();
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ==========================================
// 5. ACTIONS UTILISATEUR
// ==========================================

function toggleQuest(id, event) {
  const quest = quests.find(q => q.id === id);
  if (!quest) return;

  quest.completed = !quest.completed;
  saveQuests();

  if (quest.completed) {
    sfx.playComplete();

    // Position des particules et du texte +XP
    const rect = event.currentTarget.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);

    showFloatingXP(rect.left, rect.top, quest.xp);
  }

  renderQuests();
}

function showFloatingXP(x, y, xp) {
  const el = document.createElement('span');
  el.className = 'floating-xp';
  el.textContent = `+${xp} XP`;
  el.style.left = `${x}px`;
  el.style.top = `${y - 20}px`;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 1000);
}

function deleteQuest(id) {
  quests = quests.filter(q => q.id !== id);
  sfx.playDelete();
  saveQuests();
  renderQuests();
}

// ==========================================
// 6. ÉVÉNEMENTS & INITIALISATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Application du thème initial
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.getElementById('themeSelect').value = currentTheme;

  // Changement de thème
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    currentTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('rpg_theme', currentTheme);
  });

  // Toggle du Son
  const soundBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  
  function updateSoundUI() {
    if (soundEnabled) {
      soundIcon.setAttribute('data-lucide', 'volume-2');
    } else {
      soundIcon.setAttribute('data-lucide', 'volume-x');
    }
    if (window.lucide) lucide.createIcons();
  }
  updateSoundUI();

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('rpg_sound', soundEnabled);
    updateSoundUI();
  });

  // Soumission du Formulaire de Quête
  document.getElementById('addQuestForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('questTitle').value.trim();
    const category = document.getElementById('questCategory').value;
    const xp = Number(document.getElementById('questXp').value) || 50;
    const desc = document.getElementById('questDesc').value.trim();

    if (!title) return;

    const newQuest = {
      id: Date.now().toString(),
      title,
      category,
      xp,
      desc,
      completed: false,
      createdAt: Date.now()
    };

    quests.unshift(newQuest);
    saveQuests();
    sfx.playAdd();

    // Reset du formulaire
    document.getElementById('questTitle').value = '';
    document.getElementById('questDesc').value = '';
    document.getElementById('questXp').value = 50;

    renderQuests();
  });

  // Barre de Recherche
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderQuests();
  });

  // Filtres par Statut
  document.querySelectorAll('#statusFilterGroup .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#statusFilterGroup .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.status;
      renderQuests();
    });
  });

  // Filtres par Catégorie
  document.querySelectorAll('#categoryFilterGroup .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#categoryFilterGroup .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategoryFilter = btn.dataset.cat;
      renderQuests();
    });
  });

  // Premier rendu
  renderQuests();
});