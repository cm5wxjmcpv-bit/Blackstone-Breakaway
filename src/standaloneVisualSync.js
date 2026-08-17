const url = (path) => new URL(`../games/miner-incremental/assets/${path}`, import.meta.url).href;
const background = url('backgrounds/blackstone-shaft.webp');
const minerSrc = url('characters/miner-swing.webp');
const depositImages = [
  [/diamond.*quartz|quartz.*diamond/i, 'deposits/diamond-quartz-spine.webp'],
  [/diamond/i, 'deposits/diamond-cluster.webp'],
  [/layered coal|anthracite|dense coal/i, 'deposits/coal-seam-layered.webp'],
  [/coal/i, 'deposits/coal-seam.webp'],
  [/copper/i, 'deposits/copper-vein.webp'],
  [/iron/i, 'deposits/iron-vein.webp'],
  [/silver/i, 'deposits/silver-vein.webp'],
  [/gold/i, 'deposits/gold-vein.webp'],
  [/emerald/i, 'deposits/emerald-pocket.webp'],
  [/ruby/i, 'deposits/ruby-pocket.webp'],
  [/stone|rock/i, 'deposits/stone-face.webp'],
];

function addStyles() {
  if (document.querySelector('[data-standalone-visual-sync]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../standalone-visual-sync.css', import.meta.url).href;
  link.dataset.standaloneVisualSync = 'true';
  document.head.append(link);
}

function numericText(node) {
  const value = String(node?.textContent || '').replaceAll(',', '').match(/\d+(?:\.\d+)?/);
  return value ? Number(value[0]) : 0;
}

function artForDeposit(name) {
  const match = depositImages.find(([pattern]) => pattern.test(name));
  return match ? url(match[1]) : '';
}

function install(root) {
  if (root.dataset.visualSyncInstalled) return;
  root.dataset.visualSyncInstalled = 'true';
  const stage = root.querySelector('#incremental-mine-stage');
  const miner = root.querySelector('.incremental-miner');
  const target = root.querySelector('#incremental-mining-target');
  const rock = root.querySelector('.incremental-rock');
  if (!stage || !miner || !target || !rock) return;

  stage.style.backgroundImage = `linear-gradient(180deg, rgba(6,5,5,.28), rgba(10,8,7,.70)), url("${background}")`;
  stage.style.backgroundPosition = 'center';
  stage.style.backgroundRepeat = 'no-repeat';
  stage.style.backgroundSize = 'cover';

  const hud = document.createElement('div');
  hud.className = 'incremental-mine-hud';
  hud.innerHTML = '<div class="incremental-mine-xp-progress" role="progressbar" aria-label="Experience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><output class="incremental-mine-cash" aria-label="Cash">$0</output>';
  stage.prepend(hud);

  const minerArt = document.createElement('img');
  minerArt.className = 'incremental-miner-art-sync';
  minerArt.alt = '';
  minerArt.draggable = false;
  minerArt.hidden = true;
  minerArt.addEventListener('load', () => {
    minerArt.hidden = false;
    miner.classList.add('standalone-miner-upgraded');
  });
  minerArt.addEventListener('error', () => {
    minerArt.hidden = true;
    miner.classList.remove('standalone-miner-upgraded');
  });
  minerArt.src = minerSrc;
  miner.prepend(minerArt);

  const depositArt = document.createElement('img');
  depositArt.className = 'incremental-deposit-art-sync';
  depositArt.alt = '';
  depositArt.draggable = false;
  depositArt.hidden = true;
  rock.append(depositArt);

  target.addEventListener('click', () => {
    if (minerArt.hidden) return;
    minerArt.classList.remove('is-swinging');
    void minerArt.offsetWidth;
    minerArt.classList.add('is-swinging');
    setTimeout(() => minerArt.classList.remove('is-swinging'), 220);
  });

  let lastDeposit = '';
  setInterval(() => {
    const cash = root.querySelector('#incremental-cash');
    const mineCash = hud.querySelector('.incremental-mine-cash');
    if (cash && mineCash.textContent !== cash.textContent) mineCash.textContent = cash.textContent;

    const sourceBar = root.querySelector('#incremental-xp-bar');
    const mineProgress = hud.querySelector('.incremental-mine-xp-progress');
    const mineBar = mineProgress.querySelector('span');
    if (sourceBar) {
      mineBar.style.width = sourceBar.style.width || '0%';
      const sourceProgress = sourceBar.parentElement;
      mineProgress.setAttribute('aria-valuemax', sourceProgress.getAttribute('aria-valuemax') || '100');
      mineProgress.setAttribute('aria-valuenow', sourceProgress.getAttribute('aria-valuenow') || '0');
      const hasPoint = numericText(root.querySelector('#incremental-skill-points')) > 0;
      mineProgress.classList.toggle('has-skill-point', hasPoint);
      sourceProgress.classList.toggle('has-skill-point', hasPoint);
    }

    const name = root.querySelector('#incremental-deposit-name')?.textContent?.trim() || '';
    if (name !== lastDeposit) {
      lastDeposit = name;
      const next = artForDeposit(name);
      if (!next) {
        depositArt.hidden = true;
        target.classList.remove('has-standalone-deposit-art');
      } else {
        depositArt.onload = () => {
          depositArt.hidden = false;
          target.classList.add('has-standalone-deposit-art');
        };
        depositArt.onerror = () => {
          depositArt.hidden = true;
          target.classList.remove('has-standalone-deposit-art');
        };
        depositArt.src = next;
      }
    }
  }, 120);
}

function start() {
  addStyles();
  const timer = setInterval(() => {
    const root = document.querySelector('#incremental-runtime');
    if (!root) return;
    clearInterval(timer);
    install(root);
  }, 50);
}

start();
