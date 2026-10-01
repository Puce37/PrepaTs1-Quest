/**
 * JOURNAL DE QUÊTES RPG - MOTEUR JAVASCRIPT
 */

// Difficultés & Bandeaux
const DIFFICULTY_MAP = {
  easy: { label: '🟢 Facile', xp: 25, bannerClass: 'banner-easy' },
  medium: { label: '🔵 Moyenne', xp: 50, bannerClass: 'banner-medium' },
  hard: { label: '🔴 Difficile', xp: 100, bannerClass: 'banner-hard' },
  epic: { label: '🟣 Épique', xp: 250, bannerClass: 'banner-epic' }
};

// Catégories
const CATEGORY_MAP = {
  main: { label: '🔥 Principale', class: 'cat-main' },
  side: { label: '📜 Secondaire', class: 'cat-side' },
  optional: { label: '💡 Facultative', class: 'cat-optional' },
  urgent: { label: '🚨 Urgente', class: 'cat-urgent' }
};

// État initial
let quests = JSON.parse(localStorage.getItem('rpg_quests_v3')) || [
  {
    id: '1',
    title: 'Finaliser le projet important',
    category: 'urgent',
    difficulty: 'hard',
    desc: 'À rendre en priorité aujourd\'hui.',
    completed: false
  },
  {
    id: '2',
    title: 'Découvrir les fonctionnalités du journal',
    category: 'main',
    difficulty: 'easy',
    desc: 'Cocher cette quête pour tester l\'expérience.',
    completed: true
  },
  {
    id: '3',
    title: 'Ranger le bureau',
    category: 'optional',
    difficulty: 'easy',
    desc: 'Un espace propre améliore la concentration.',
    completed: false
  }
];

let currentTheme = localStorage.getItem('rpg_theme') || 'dark-minimal';
let currentStatusFilter = 'all';
let currentCategoryFilter = 'all';
let searchQuery = '';
let soundEnabled = localStorage.getItem('rpg_sound') !== 'false';

// ==========================================
// EFFETS SONORES (Web Audio API)
// ==========================================
class SoundFX {
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
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    osc.frequency.setValueAtTime(783.99, now + 0.16);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playAdd() {
    if (!soundEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playDelete() {
    if (!soundEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.12);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }
}

const sfx = new SoundFX();

// ==========================================
// PARTICULES
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

function spawnParticles(x, y) {
  for (let i = 0; i < 15; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 1,
      radius: Math.random() * 2 + 1.5,
      alpha: 1,
      color: '#10B981'
    });
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.alpha > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();

// ==========================================
// RENDU ET GESTION
// ==========================================

function saveQuests() {
  localStorage.setItem('rpg_quests_v3', JSON.stringify(quests));
}

function updateHUD() {
  const total = quests.length;
  const completed = quests.filter(q => q.completed).length;

  const totalXP = quests
    .filter(q => q.completed)
    .reduce((sum, q) => sum + (DIFFICULTY_MAP[q.difficulty]?.xp || 50), 0);

  const level = Math.floor(totalXP / 100) + 1;
  const currentXP = totalXP % 100;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('levelDisplay').textContent = `Niveau ${level}`;
  document.getElementById('xpText').textContent = `${currentXP} / 100 XP`;
  document.getElementById('xpBarFill').style.width = `${currentXP}%`;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statRate').textContent = `${rate}%`;
}

function renderQuests() {
  const questListEl = document.getElementById('questList');
  const emptyStateEl = document.getElementById('emptyState');

  const filtered = quests.filter(quest => {
    const matchStatus = 
      currentStatusFilter === 'all' ? true :
      currentStatusFilter === 'completed' ? quest.completed : !quest.completed;

    const matchCat = 
      currentCategoryFilter === 'all' ? true : quest.category === currentCategoryFilter;

    const matchSearch = 
      quest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quest.desc && quest.desc.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchStatus && matchCat && matchSearch;
  });

  questListEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyStateEl.classList.remove('hidden');
  } else {
    emptyStateEl.classList.add('hidden');

    filtered.forEach(quest => {
      const diffInfo = DIFFICULTY_MAP[quest.difficulty] || DIFFICULTY_MAP.medium;
      const catInfo = CATEGORY_MAP[quest.category] || CATEGORY_MAP.side;

      const card = document.createElement('div');
      card.className = `quest-item ${quest.completed ? 'completed' : ''}`;

      card.innerHTML = `
        <!-- Bandeau Coloré à Gauche -->
        <div class="quest-banner ${diffInfo.bannerClass}"></div>

        <div class="quest-left">
          <div class="checkbox" onclick="toggleQuest('${quest.id}', event)">
            ${quest.completed ? '<i data-lucide="check" style="width:14px;height:14px;"></i>' : ''}
          </div>
          <div class="quest-details">
            <div class="tags-row">
              <span class="badge ${catInfo.class}">${catInfo.label}</span>
              <span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted);">
                ${diffInfo.label} (+${diffInfo.xp} XP)
              </span>
            </div>
            <div class="quest-name">${escapeHTML(quest.title)}</div>
            ${quest.desc ? `<div class="quest-desc-text">${escapeHTML(quest.desc)}</div>` : ''}
          </div>
        </div>
        <div class="quest-right">
          <button class="delete-btn" onclick="deleteQuest('${quest.id}')" title="Supprimer">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
          </button>
        </div>
      `;

      questListEl.appendChild(card);
    });
  }

  if (window.lucide) lucide.createIcons();
  updateHUD();
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function toggleQuest(id, event) {
  const quest = quests.find(q => q.id === id);
  if (!quest) return;

  quest.completed = !quest.completed;
  saveQuests();

  if (quest.completed) {
    sfx.playComplete();
    const rect = event.currentTarget.getBoundingClientRect();
    spawnParticles(rect.left + 10, rect.top + 10);

    const xpAmount = DIFFICULTY_MAP[quest.difficulty]?.xp || 50;
    showFloatingXP(rect.left, rect.top, xpAmount);
  }

  renderQuests();
}

function showFloatingXP(x, y, xp) {
  const el = document.createElement('span');
  el.className = 'floating-xp';
  el.textContent = `+${xp} XP`;
  el.style.left = `${x}px`;
  el.style.top = `${y - 15}px`;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 800);
}

function deleteQuest(id) {
  quests = quests.filter(q => q.id !== id);
  sfx.playDelete();
  saveQuests();
  renderQuests();
}

// ==========================================
// INITIALISATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.getElementById('themeSelect').value = currentTheme;

  // Sélecteur de Thème
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    currentTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('rpg_theme', currentTheme);
  });

  // Toggle Son
  const soundBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  
  function updateSoundUI() {
    soundIcon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
    if (window.lucide) lucide.createIcons();
  }
  updateSoundUI();

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('rpg_sound', soundEnabled);
    updateSoundUI();
  });

  // Soumission Formulaire
  document.getElementById('addQuestForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('questTitle').value.trim();
    const category = document.getElementById('questCategory').value;
    const difficulty = document.getElementById('questDifficulty').value;
    const desc = document.getElementById('questDesc').value.trim();

    if (!title) return;

    quests.unshift({
      id: Date.now().toString(),
      title,
      category,
      difficulty,
      desc,
      completed: false
    });

    saveQuests();
    sfx.playAdd();

    document.getElementById('questTitle').value = '';
    document.getElementById('questDesc').value = '';
    document.getElementById('questDifficulty').value = 'medium';

    renderQuests();
  });

  // Barre de recherche
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderQuests();
  });

  // Filtres statut
  document.querySelectorAll('#statusFilterGroup .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#statusFilterGroup .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.status;
      renderQuests();
    });
  });

  // Filtres catégorie
  document.querySelectorAll('#categoryFilterGroup .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#categoryFilterGroup .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategoryFilter = btn.dataset.cat;
      renderQuests();
    });
  });

  renderQuests();
});