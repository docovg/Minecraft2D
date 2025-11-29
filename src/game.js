// src/game.js
'use strict';

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
let WS = null;
try { WS = require('ws'); } catch (e) { WS = null; }

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const screenMain = document.getElementById('screen-main');
const screenSingle = document.getElementById('screen-single');
const screenMulti = document.getElementById('screen-multi');
const screenOptions = document.getElementById('screen-options');

const btnMainSingle = document.getElementById('btn-main-single');
const btnMainMulti = document.getElementById('btn-main-multi');
const btnMainOptions = document.getElementById('btn-main-options');
const btnMainQuit = document.getElementById('btn-main-quit');

const worldListDiv = document.getElementById('world-list');
const btnSpPlay = document.getElementById('btn-sp-play');
const btnSpCreate = document.getElementById('btn-sp-create');
const btnSpDelete = document.getElementById('btn-sp-delete');
const btnSpBack = document.getElementById('btn-sp-back');
const inputNewWorldName = document.getElementById('input-new-world-name');
const inputNewWorldSeed = document.getElementById('input-new-world-seed');
const selectNewDifficulty = document.getElementById('select-new-difficulty');

const serverListDiv = document.getElementById('server-list');
const btnMpJoin = document.getElementById('btn-mp-join');
const btnMpAdd = document.getElementById('btn-mp-add');
const btnMpRemove = document.getElementById('btn-mp-remove');
const btnMpDirect = document.getElementById('btn-mp-direct');
const btnMpBack = document.getElementById('btn-mp-back');
const inputServerName = document.getElementById('input-server-name');
const inputServerAddress = document.getElementById('input-server-address');
const inputDirectAddress = document.getElementById('input-direct-address');

const optDebug = document.getElementById('opt-debug');
const optMoveSpeed = document.getElementById('opt-move-speed');
const btnOptionsBack = document.getElementById('btn-options-back');

const pauseOverlay = document.getElementById('pause-overlay');
const btnPauseResume = document.getElementById('btn-pause-resume');
const btnPauseLan = document.getElementById('btn-pause-lan');
const btnPauseSaveMenu = document.getElementById('btn-pause-save-menu');
const btnPauseQuit = document.getElementById('btn-pause-quit');

const heartsDiv = document.getElementById('hearts');
const hotbarDiv = document.getElementById('hotbar');
const debugDiv = document.getElementById('debug-overlay');

const inventoryOverlay = document.getElementById('inventory-overlay');
const invGrid = document.getElementById('inv-grid');
const btnInvClose = document.getElementById('btn-inv-close');

const appRoot = path.join(__dirname, '..');
const savesDir = path.join(appRoot, 'saves');
const serversFile = path.join(appRoot, 'servers.json');
if (!fs.existsSync(savesDir)) {
  try { fs.mkdirSync(savesDir, { recursive: true }); } catch (e) {}
}

const BLOCK = Engine.BLOCK;
const HOTBAR_SIZE = 9;
const REACH = 6;
const NET_PORT_DEFAULT = 34567;

let state = null;
let lastTime = 0;
let inMenu = true;
let paused = false;
let showDebug = false;
let moveSpeed = 7;
let inventoryOpen = false;
let previewOrientation = 0;
let shiftDown = false;

let currentWorldName = null;
let currentWorldFile = null;

const hotbarSlots = new Array(HOTBAR_SIZE);
let selectedHotbar = 0;

let hoverTile = null;
let fps = 0;
let fpsTimer = 0;
let fpsFrames = 0;

let worlds = [];
let selectedWorldIndex = -1;

let servers = [];
let selectedServerIndex = -1;

let isHost = false;
let hostServer = null;
let hostClients = new Map();
let nextClientId = 1;

let clientSocket = null;
let myNetId = null;
const remotePlayers = new Map();

const creativeItems = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.BEDROCK,
  BLOCK.SAND,
  BLOCK.SNOW,
  BLOCK.LOG,
  BLOCK.LEAVES,
  BLOCK.PLANKS,
  BLOCK.COAL,
  BLOCK.IRON,
  BLOCK.GOLD,
  BLOCK.DIAMOND,
  BLOCK.BED,
  BLOCK.WOOD_STAIRS_L,
  BLOCK.WOOD_SLAB_BOTTOM
];

const BLOCK_LABELS = {};
BLOCK_LABELS[BLOCK.GRASS] = 'Herbe';
BLOCK_LABELS[BLOCK.DIRT] = 'Terre';
BLOCK_LABELS[BLOCK.STONE] = 'Pierre';
BLOCK_LABELS[BLOCK.BEDROCK] = 'Bedrock';
BLOCK_LABELS[BLOCK.SAND] = 'Sable';
BLOCK_LABELS[BLOCK.SNOW] = 'Neige';
BLOCK_LABELS[BLOCK.LOG] = 'Tronc';
BLOCK_LABELS[BLOCK.LEAVES] = 'Feuilles';
BLOCK_LABELS[BLOCK.PLANKS] = 'Planches';
BLOCK_LABELS[BLOCK.COAL] = 'Charbon';
BLOCK_LABELS[BLOCK.IRON] = 'Minerai de fer';
BLOCK_LABELS[BLOCK.GOLD] = 'Minerai d\'or';
BLOCK_LABELS[BLOCK.DIAMOND] = 'Minerai de diamant';
BLOCK_LABELS[BLOCK.BED] = 'Lit';
BLOCK_LABELS[BLOCK.WOOD_STAIRS_L] = 'Escaliers en bois';
BLOCK_LABELS[BLOCK.WOOD_SLAB_BOTTOM] = 'Dalle en bois';

function setScreen(name) {
  screenMain.classList.remove('active');
  screenSingle.classList.remove('active');
  screenMulti.classList.remove('active');
  screenOptions.classList.remove('active');
  if (name === 'main') screenMain.classList.add('active');
  if (name === 'single') screenSingle.classList.add('active');
  if (name === 'multi') screenMulti.classList.add('active');
  if (name === 'options') screenOptions.classList.add('active');
}

function initHotbar() {
  for (let i = 0; i < HOTBAR_SIZE; i++) hotbarSlots[i] = null;
  hotbarSlots[0] = { id: BLOCK.DIRT, count: -1 };
  hotbarSlots[1] = { id: BLOCK.STONE, count: -1 };
  hotbarSlots[2] = { id: BLOCK.SAND, count: -1 };
  hotbarSlots[3] = { id: BLOCK.SNOW, count: -1 };
  hotbarSlots[4] = { id: BLOCK.PLANKS, count: -1 };
  hotbarSlots[5] = { id: BLOCK.LOG, count: -1 };
  hotbarSlots[6] = { id: BLOCK.LEAVES, count: -1 };
  hotbarSlots[7] = { id: BLOCK.COAL, count: -1 };
  hotbarSlots[8] = { id: BLOCK.IRON, count: -1 };

  hotbarDiv.innerHTML = '';
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = String(i);
    slot.addEventListener('click', () => {
      selectedHotbar = i;
      updateHotbarUI();
    });
    hotbarDiv.appendChild(slot);
  }
  updateHotbarUI();
}

function updateHotbarUI() {
  const slots = hotbarDiv.querySelectorAll('.slot');
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const s = hotbarSlots[i];
    const el = slots[i];
    if (!el) continue;
    if (i === selectedHotbar) el.classList.add('selected');
    else el.classList.remove('selected');
    if (s && s.id != null) {
      el.textContent = s.count < 0 ? '∞' : String(s.count);
      el.style.background = 'linear-gradient(to bottom right,' + Engine.getBlockColor(s.id) + ',#000000)';
    } else {
      el.textContent = '';
      el.style.background = 'rgba(0,0,0,0.7)';
    }
  }
}

function buildHearts() {
  heartsDiv.innerHTML = '';
  if (!state) return;
  const total = state.player.maxHealth / 2;
  for (let i = 0; i < total; i++) {
    const div = document.createElement('div');
    div.className = 'heart';
    heartsDiv.appendChild(div);
  }
}

function drawHeartInto(elem, stateVal) {
  const size = 18;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const c = off.getContext('2d');
  c.save();
  c.scale(size / 16, size / 16);
  c.beginPath();
  c.moveTo(8, 14);
  c.bezierCurveTo(3, 10, 0, 7, 0, 4);
  c.bezierCurveTo(0, 1.5, 2, 0, 4, 0);
  c.bezierCurveTo(5.5, 0, 7, 0.8, 8, 2);
  c.bezierCurveTo(9, 0.8, 10.5, 0, 12, 0);
  c.bezierCurveTo(14, 0, 16, 1.5, 16, 4);
  c.bezierCurveTo(16, 7, 13, 10, 8, 14);
  c.closePath();
  c.fillStyle = 'rgba(40,0,0,0.7)';
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.9)';
  c.lineWidth = 1;
  c.stroke();

  if (stateVal > 0) {
    c.save();
    if (stateVal === 1) {
      c.beginPath();
      c.rect(0, 0, 8, 16);
      c.clip();
    }
    c.beginPath();
    c.moveTo(8, 14);
    c.bezierCurveTo(3, 10, 0, 7, 0, 4);
    c.bezierCurveTo(0, 1.5, 2, 0, 4, 0);
    c.bezierCurveTo(5.5, 0, 7, 0.8, 8, 2);
    c.bezierCurveTo(9, 0.8, 10.5, 0, 12, 0);
    c.bezierCurveTo(14, 0, 16, 1.5, 16, 4);
    c.bezierCurveTo(16, 7, 13, 10, 8, 14);
    c.closePath();
    const grad = c.createLinearGradient(0, 0, 0, 16);
    grad.addColorStop(0, '#ff6060');
    grad.addColorStop(1, '#c00000');
    c.fillStyle = grad;
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 0.8;
    c.stroke();
    c.restore();
  }

  c.restore();
  elem.style.backgroundImage = 'url(' + off.toDataURL() + ')';
  elem.style.backgroundSize = 'contain';
}

let lastHealthDrawn = -1;
function updateHeartsUI(force) {
  if (!state) return;
  if (!force && state.player.health === lastHealthDrawn) return;
  lastHealthDrawn = state.player.health;
  const total = state.player.maxHealth / 2;
  let hp = state.player.health;
  const elems = heartsDiv.querySelectorAll('.heart');
  for (let i = 0; i < total; i++) {
    let v = 0;
    if (hp >= 2) v = 2;
    else if (hp === 1) v = 1;
    drawHeartInto(elems[i], v);
    hp -= 2;
    if (hp < 0) hp = 0;
  }
}

function buildInventoryUI() {
  invGrid.innerHTML = '';
  creativeItems.forEach((id) => {
    const item = document.createElement('div');
    item.className = 'inv-item';
    item.style.background = 'linear-gradient(to bottom right,' + Engine.getBlockColor(id) + ',#000000)';
    const label = (BLOCK_LABELS[id] || '?');
    item.title = label;
    item.textContent = label[0] || '?';
    item.addEventListener('click', () => {
      hotbarSlots[selectedHotbar] = { id, count: -1 };
      updateHotbarUI();
    });
    invGrid.appendChild(item);
  });
}

function openInventory() {
  if (!state || inMenu || paused) return;
  inventoryOpen = true;
  inventoryOverlay.classList.remove('hidden');
}

function closeInventory() {
  inventoryOpen = false;
  inventoryOverlay.classList.add('hidden');
}

function sanitizeWorldName(name) {
  return name.replace(/[^a-z0-9_\-]/gi, '_');
}

function saveWorld() {
  if (!state || !currentWorldFile) return;
  const chunksObj = {};
  for (const [cx, chunk] of state.chunks.entries()) {
    chunksObj[cx] = {
      blocks: chunk.blocks,
      backBlocks: chunk.backBlocks
    };
  }
  const data = {
    name: currentWorldName,
    seed: state.seed,
    difficulty: state.difficulty,
    creative: !!state.creative,
    player: {
      x: state.player.x,
      y: state.player.y,
      health: state.player.health
    },
    lastPlayed: Date.now(),
    chunks: chunksObj
  };
  try {
    fs.writeFileSync(currentWorldFile, JSON.stringify(data));
  } catch (e) {
    console.error('Erreur de sauvegarde', e);
  }
}

function loadWorldFromData(data) {
  const creative = (data.creative !== false);
  state = Engine.createState(data.seed, data.difficulty, creative);
  if (data.player) {
    state.player.x = data.player.x;
    state.player.y = data.player.y;
    if (typeof data.player.health === 'number') {
      state.player.health = data.player.health;
    }
  }
  state.chunks.clear();
  const chunks = data.chunks || {};
  for (const key in chunks) {
    const cx = parseInt(key, 10);
    const entry = chunks[key];
    const blocks = entry.blocks || entry;
    const backBlocks = entry.backBlocks || null;
    const chunk = { chunkX: cx, blocks: blocks };
    if (backBlocks) {
      chunk.backBlocks = backBlocks;
    }
    state.chunks.set(cx, chunk);
  }
}

function refreshWorldList() {
  worlds = [];
  selectedWorldIndex = -1;
  worldListDiv.innerHTML = '';
  let files = [];
  try {
    files = fs.readdirSync(savesDir);
  } catch (e) {}
  for (const fname of files) {
    if (!fname.endsWith('.json')) continue;
    const full = path.join(savesDir, fname);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const data = JSON.parse(raw);
      worlds.push({
        name: data.name || fname.replace(/\.json$/,''),
        file: full,
        lastPlayed: data.lastPlayed || 0
      });
    } catch (e) {
      console.error('Erreur lecture monde', fname, e);
    }
  }
  worlds.sort((a,b) => (b.lastPlayed||0) - (a.lastPlayed||0));

  worlds.forEach((w, idx) => {
    const item = document.createElement('div');
    item.className = 'list-item world-item';
    item.dataset.index = String(idx);

    const title = document.createElement('div');
    title.className = 'list-item-title';
    title.textContent = w.name;
    item.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'list-item-sub';
    if (w.lastPlayed) {
      const d = new Date(w.lastPlayed);
      sub.textContent = 'Dernière partie : ' + d.toLocaleString();
    } else {
      sub.textContent = 'Jamais joué';
    }
    item.appendChild(sub);

    item.addEventListener('click', () => {
      selectedWorldIndex = idx;
      updateWorldSelectionUI();
    });

    worldListDiv.appendChild(item);
  });
}

function updateWorldSelectionUI() {
  const items = worldListDiv.querySelectorAll('.list-item');
  items.forEach((el) => el.classList.remove('selected'));
  if (selectedWorldIndex >= 0 && selectedWorldIndex < items.length) {
    items[selectedWorldIndex].classList.add('selected');
  }
}

function loadServers() {
  servers = [];
  selectedServerIndex = -1;
  try {
    if (fs.existsSync(serversFile)) {
      const raw = fs.readFileSync(serversFile, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) servers = arr;
    }
  } catch (e) {
    console.error('Erreur lecture servers.json', e);
  }
  if (servers.length === 0) {
    servers.push({
      name: 'Serveur officiel',
      address: 'ws://163.5.141.45:25568'
    });
  }
  renderServerList();
}

function saveServers() {
  try {
    fs.writeFileSync(serversFile, JSON.stringify(servers, null, 2));
  } catch (e) {
    console.error('Erreur sauvegarde servers.json', e);
  }
}

function renderServerList() {
  serverListDiv.innerHTML = '';
  servers.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'list-item server-item';
    item.dataset.index = String(idx);

    const title = document.createElement('div');
    title.className = 'list-item-title';
    title.textContent = s.name;
    item.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'list-item-sub';
    sub.textContent = s.address;
    item.appendChild(sub);

    item.addEventListener('click', () => {
      selectedServerIndex = idx;
      updateServerSelectionUI();
      inputServerName.value = s.name;
      inputServerAddress.value = s.address;
    });

    serverListDiv.appendChild(item);
  });
}

function updateServerSelectionUI() {
  const items = serverListDiv.querySelectorAll('.list-item');
  items.forEach((el) => el.classList.remove('selected'));
  if (selectedServerIndex >= 0 && selectedServerIndex < items.length) {
    items[selectedServerIndex].classList.add('selected');
  }
}

function startHost(port) {
  if (!WS) return;
  if (hostServer) return;
  const WebSocketServer = WS.Server || WS.WebSocketServer || WS;
  const p = port || NET_PORT_DEFAULT;
  hostServer = new WebSocketServer({ port: p });
  isHost = true;
  hostClients.clear();
  nextClientId = 1;
  hostServer.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg = null;
      try { msg = JSON.parse(data.toString()); } catch (e) {}
      if (!msg) return;
      handleHostMessage(ws, msg);
    });
    ws.on('close', () => {
      const id = hostClients.get(ws);
      if (id != null) {
        hostClients.delete(ws);
        remotePlayers.delete(id);
      }
    });
  });
  console.log('Serveur LAN ouvert sur le port', p);
}

function stopHost() {
  if (hostServer) {
    try { hostServer.close(); } catch (e) {}
    hostServer = null;
  }
  isHost = false;
  hostClients.clear();
}

function hostBroadcast(msg, exceptWs) {
  if (!hostServer) return;
  const s = JSON.stringify(msg);
  hostServer.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN && ws !== exceptWs) {
      ws.send(s);
    }
  });
}

function handleHostMessage(ws, msg) {
  if (!state) return;
  if (msg.type === 'hello') {
    const id = nextClientId++;
    hostClients.set(ws, id);
    const welcome = {
      type: 'welcome',
      id,
      seed: state.seed,
      difficulty: state.difficulty,
      creative: !!state.creative
    };
    ws.send(JSON.stringify(welcome));
    return;
  }
  const id = hostClients.get(ws);
  if (!id) return;

  if (msg.type === 'state') {
    remotePlayers.set(id, { x: msg.x, y: msg.y });
    hostBroadcast({ type: 'state', id, x: msg.x, y: msg.y }, ws);
  } else if (msg.type === 'block') {
    const layer = msg.layer || 0;
    if (layer === 0) {
      Engine.setBlock(state, msg.x, msg.y, msg.id);
    } else {
      Engine.setBackBlock(state, msg.x, msg.y, msg.id);
    }
    hostBroadcast({ type: 'block', x: msg.x, y: msg.y, id: msg.id, layer }, ws);
  }
}

function connectToServer(url) {
  if (clientSocket) {
    try { clientSocket.close(); } catch (e) {}
  }
  clientSocket = new WebSocket(url);
  myNetId = null;
  remotePlayers.clear();
  clientSocket.onopen = () => {
    clientSocket.send(JSON.stringify({ type: 'hello' }));
  };
  clientSocket.onmessage = (ev) => {
    let msg = null;
    try { msg = JSON.parse(ev.data); } catch (e) {}
    if (!msg) return;
    handleClientMessage(msg);
  };
  clientSocket.onclose = () => {
    clientSocket = null;
    myNetId = null;
    remotePlayers.clear();
  };
}

function handleClientMessage(msg) {
  if (msg.type === 'welcome') {
    myNetId = msg.id;
    if (!state) {
      state = Engine.createState(msg.seed, msg.difficulty, msg.creative);
      inMenu = false;
      setScreen(null);
      initHotbar();
      buildHearts();
      updateHeartsUI(true);
    }
  } else if (msg.type === 'state') {
    if (myNetId != null && msg.id === myNetId) return;
    remotePlayers.set(msg.id, { x: msg.x, y: msg.y });
  } else if (msg.type === 'block') {
    if (!state) return;
    const layer = msg.layer || 0;
    if (layer === 0) {
      Engine.setBlock(state, msg.x, msg.y, msg.id);
    } else {
      Engine.setBackBlock(state, msg.x, msg.y, msg.id);
    }
  }
}

function isClientConnected() {
  return clientSocket && clientSocket.readyState === WebSocket.OPEN;
}

function stopNetworking() {
  stopHost();
  if (clientSocket) {
    try { clientSocket.close(); } catch (e) {}
    clientSocket = null;
  }
  myNetId = null;
  remotePlayers.clear();
}

btnMainSingle.addEventListener('click', () => {
  inMenu = true;
  refreshWorldList();
  setScreen('single');
});

btnMainMulti.addEventListener('click', () => {
  inMenu = true;
  loadServers();
  setScreen('multi');
});

btnMainOptions.addEventListener('click', () => {
  inMenu = true;
  optDebug.checked = showDebug;
  optMoveSpeed.value = String(moveSpeed);
  setScreen('options');
});

btnMainQuit.addEventListener('click', () => {
  window.close && window.close();
});

btnSpBack.addEventListener('click', () => {
  setScreen('main');
});

btnSpCreate.addEventListener('click', () => {
  const name = inputNewWorldName.value.trim() || 'Nouveau monde';
  const seed = inputNewWorldSeed.value.trim() || (Date.now().toString() + name);
  const diff = selectNewDifficulty.value || 'normal';
  const safeName = sanitizeWorldName(name);
  currentWorldName = name;
  currentWorldFile = path.join(savesDir, safeName + '.json');
  stopNetworking();
  state = Engine.createState(seed, diff, true);
  inMenu = false;
  paused = false;
  inventoryOpen = false;
  inventoryOverlay.classList.add('hidden');
  setScreen(null);
  initHotbar();
  buildHearts();
  updateHeartsUI(true);
});

btnSpPlay.addEventListener('click', () => {
  if (selectedWorldIndex < 0 || selectedWorldIndex >= worlds.length) return;
  const w = worlds[selectedWorldIndex];
  currentWorldName = w.name;
  currentWorldFile = w.file;
  stopNetworking();
  try {
    const raw = fs.readFileSync(w.file, 'utf8');
    const data = JSON.parse(raw);
    loadWorldFromData(data);
    state.creative = true;
  } catch (e) {
    console.error('Erreur chargement monde', e);
    const diff = selectNewDifficulty.value || 'normal';
    state = Engine.createState(Date.now().toString(), diff, true);
  }
  inMenu = false;
  paused = false;
  inventoryOpen = false;
  inventoryOverlay.classList.add('hidden');
  setScreen(null);
  initHotbar();
  buildHearts();
  updateHeartsUI(true);
});

btnSpDelete.addEventListener('click', () => {
  if (selectedWorldIndex < 0 || selectedWorldIndex >= worlds.length) return;
  const w = worlds[selectedWorldIndex];
  try {
    fs.unlinkSync(w.file);
  } catch (e) {}
  refreshWorldList();
});

btnMpBack.addEventListener('click', () => {
  setScreen('main');
});

btnMpAdd.addEventListener('click', () => {
  const name = inputServerName.value.trim();
  const addr = inputServerAddress.value.trim();
  if (!name || !addr) return;
  servers.push({ name, address: addr });
  saveServers();
  renderServerList();
});

btnMpRemove.addEventListener('click', () => {
  if (selectedServerIndex < 0 || selectedServerIndex >= servers.length) return;
  servers.splice(selectedServerIndex, 1);
  saveServers();
  renderServerList();
  selectedServerIndex = -1;
  updateServerSelectionUI();
});

btnMpJoin.addEventListener('click', () => {
  if (selectedServerIndex < 0 || selectedServerIndex >= servers.length) return;
  const addr = servers[selectedServerIndex].address;
  stopNetworking();
  currentWorldFile = null;
  currentWorldName = null;
  state = null;
  inMenu = false;
  paused = false;
  inventoryOpen = false;
  inventoryOverlay.classList.add('hidden');
  setScreen(null);
  initHotbar();
  buildHearts();
  updateHeartsUI(true);
  connectToServer(addr);
});

btnMpDirect.addEventListener('click', () => {
  const addr = inputDirectAddress.value.trim();
  if (!addr) return;
  stopNetworking();
  currentWorldFile = null;
  currentWorldName = null;
  state = null;
  inMenu = false;
  paused = false;
  inventoryOpen = false;
  inventoryOverlay.classList.add('hidden');
  setScreen(null);
  initHotbar();
  buildHearts();
  updateHeartsUI(true);
  connectToServer(addr);
});

optDebug.addEventListener('change', () => {
  showDebug = optDebug.checked;
});
optMoveSpeed.addEventListener('input', () => {
  moveSpeed = parseFloat(optMoveSpeed.value) || 7;
});

btnOptionsBack.addEventListener('click', () => {
  setScreen('main');
});

btnPauseResume.addEventListener('click', () => {
  paused = false;
  pauseOverlay.classList.add('hidden');
});

btnPauseSaveMenu.addEventListener('click', () => {
  saveWorld();
  stopNetworking();
  paused = false;
  pauseOverlay.classList.add('hidden');
  inMenu = true;
  state = null;
  inventoryOpen = false;
  inventoryOverlay.classList.add('hidden');
  setScreen('main');
  heartsDiv.innerHTML = '';
});

btnPauseQuit.addEventListener('click', () => {
  saveWorld();
  stopNetworking();
  window.close && window.close();
});

btnPauseLan.addEventListener('click', () => {
  if (!state) return;
  startHost(NET_PORT_DEFAULT);
});

function isStairsBlock(id) {
  return id === BLOCK.WOOD_STAIRS_L || id === BLOCK.WOOD_STAIRS_R;
}
function isSlabBlock(id) {
  return id === BLOCK.WOOD_SLAB_BOTTOM || id === BLOCK.WOOD_SLAB_TOP;
}
function resolvePlacedId(baseId) {
  if (isStairsBlock(baseId)) {
    return (previewOrientation & 1) === 0 ? BLOCK.WOOD_STAIRS_L : BLOCK.WOOD_STAIRS_R;
  }
  if (isSlabBlock(baseId)) {
    return (previewOrientation & 1) === 0 ? BLOCK.WOOD_SLAB_BOTTOM : BLOCK.WOOD_SLAB_TOP;
  }
  return baseId;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'F11') {
    e.preventDefault();
    ipcRenderer.send('toggle-fullscreen');
    return;
  }

  if (e.key === 'Shift') {
    shiftDown = true;
  }

  if (e.code === 'Escape') {
    if (inventoryOpen) {
      closeInventory();
      e.preventDefault();
      return;
    }
    if (!inMenu && state) {
      paused = !paused;
      pauseOverlay.classList.toggle('hidden', !paused);
      e.preventDefault();
      return;
    }
  }

  if (!inMenu && state && e.code === 'KeyE') {
    if (inventoryOpen) closeInventory();
    else openInventory();
    e.preventDefault();
    return;
  }

  if (inMenu || !state || paused || inventoryOpen) {
    if (e.code === 'F3') showDebug = !showDebug;
    return;
  }

  if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
    state.input.left = true;
    e.preventDefault();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    state.input.right = true;
    e.preventDefault();
  }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') {
    state.input.jumpQueued = true;
    e.preventDefault();
  }
  if (e.code.startsWith('Digit')) {
    const num = parseInt(e.code.slice(5), 10);
    if (num >= 1 && num <= HOTBAR_SIZE) {
      selectedHotbar = num - 1;
      updateHotbarUI();
      e.preventDefault();
    }
  }
  if (e.code === 'F3') showDebug = !showDebug;
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shiftDown = false;
  }
  if (!state || inventoryOpen) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
    state.input.left = false;
    e.preventDefault();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    state.input.right = false;
    e.preventDefault();
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!state || inventoryOpen) return;
  const rect = canvas.getBoundingClientRect();
  const cam = Engine.getCamera(state, canvas);
  const wx = (e.clientX - rect.left + cam.x) / Engine.TILE_SIZE;
  const wy = (e.clientY - rect.top + cam.y) / Engine.TILE_SIZE;
  hoverTile = { x: Math.floor(wx), y: Math.floor(wy) };
});

canvas.addEventListener('mouseleave', () => {
  hoverTile = null;
});

canvas.addEventListener('wheel', (e) => {
  if (!state || inMenu || paused || inventoryOpen) return;
  const slot = hotbarSlots[selectedHotbar];
  const special = slot && slot.id != null && (isStairsBlock(slot.id) || isSlabBlock(slot.id));
  e.preventDefault();
  if (special) {
    if (e.deltaY > 0) previewOrientation = (previewOrientation + 1) & 3;
    else previewOrientation = (previewOrientation + 3) & 3;
  } else {
    if (e.deltaY > 0) selectedHotbar = (selectedHotbar + 1) % HOTBAR_SIZE;
    else selectedHotbar = (selectedHotbar - 1 + HOTBAR_SIZE) % HOTBAR_SIZE;
    updateHotbarUI();
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (!state || inMenu || paused || inventoryOpen) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cam = Engine.getCamera(state, canvas);
  const wx = (e.clientX - rect.left + cam.x) / Engine.TILE_SIZE;
  const wy = (e.clientY - rect.top + cam.y) / Engine.TILE_SIZE;
  const tx = Math.floor(wx);
  const ty = Math.floor(wy);

  const p = state.player;
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const dx = cx - p.x;
  const dy = cy - (p.y - p.h / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > REACH) return;

  const backLayer = e.shiftKey === true;

  if (e.button === 0) {
    if (!backLayer) {
      const id = Engine.getBlock(state, tx, ty);
      if (id !== BLOCK.AIR && id !== BLOCK.BEDROCK) {
        Engine.setBlock(state, tx, ty, BLOCK.AIR);
        if (isHost) hostBroadcast({ type: 'block', x: tx, y: ty, id: BLOCK.AIR, layer: 0 }, null);
        if (isClientConnected()) {
          clientSocket.send(JSON.stringify({ type: 'block', x: tx, y: ty, id: BLOCK.AIR, layer: 0 }));
        }
      }
    } else {
      const id = Engine.getBackBlock(state, tx, ty);
      if (id !== BLOCK.AIR && id !== BLOCK.BEDROCK) {
        Engine.setBackBlock(state, tx, ty, BLOCK.AIR);
        if (isHost) hostBroadcast({ type: 'block', x: tx, y: ty, id: BLOCK.AIR, layer: 1 }, null);
        if (isClientConnected()) {
          clientSocket.send(JSON.stringify({ type: 'block', x: tx, y: ty, id: BLOCK.AIR, layer: 1 }));
        }
      }
    }
  } else if (e.button === 2) {
    const slot = hotbarSlots[selectedHotbar];
    if (!slot || slot.id == null) return;
    const placeId = resolvePlacedId(slot.id);

    if (!backLayer) {
      if (Engine.getBlock(state, tx, ty) !== BLOCK.AIR) return;
      if (Engine.wouldCollideWithPlayer(state, tx, ty)) return;
      Engine.setBlock(state, tx, ty, placeId);
      if (isHost) hostBroadcast({ type: 'block', x: tx, y: ty, id: placeId, layer: 0 }, null);
      if (isClientConnected()) {
        clientSocket.send(JSON.stringify({ type: 'block', x: tx, y: ty, id: placeId, layer: 0 }));
      }
    } else {
      if (Engine.getBackBlock(state, tx, ty) !== BLOCK.AIR) return;
      Engine.setBackBlock(state, tx, ty, placeId);
      if (isHost) hostBroadcast({ type: 'block', x: tx, y: ty, id: placeId, layer: 1 }, null);
      if (isClientConnected()) {
        clientSocket.send(JSON.stringify({ type: 'block', x: tx, y: ty, id: placeId, layer: 1 }));
      }
    }
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

btnInvClose.addEventListener('click', () => {
  closeInventory();
});

function updateDebug(dt) {
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fps = Math.round(fpsFrames / fpsTimer);
    fpsFrames = 0;
    fpsTimer = 0;
  }
  if (showDebug && state) {
    const p = state.player;
    const chunkX = Math.floor(p.x / Engine.CHUNK_WIDTH);
    debugDiv.style.display = 'block';
    debugDiv.textContent =
      'FPS: ' + fps +
      ' | Pos: (' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ')' +
      ' | Chunk: ' + chunkX +
      ' | Health: ' + p.health.toFixed(1) + '/' + p.maxHealth +
      ' | Seed: ' + state.seed +
      ' | Mode: Créatif' +
      ' | Fond: SHIFT + clic droit' +
      (isHost ? ' | Host LAN' : (isClientConnected() ? ' | Client LAN' : ''));
  } else {
    debugDiv.style.display = 'none';
  }
}

function drawHoverHighlightAndPreview() {
  if (!state || !hoverTile) return;
  const tx = hoverTile.x;
  const ty = hoverTile.y;
  const p = state.player;
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const dx = cx - p.x;
  const dy = cy - (p.y - p.h / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > REACH) return;

  const cam = Engine.getCamera(state, canvas);
  const sx = tx * Engine.TILE_SIZE - cam.x;
  const sy = ty * Engine.TILE_SIZE - cam.y;

  const slot = hotbarSlots[selectedHotbar];
  const frontId = Engine.getBlock(state, tx, ty);
  const backId = Engine.getBackBlock(state, tx, ty);
  const placingBack = shiftDown;

  let canPlace = false;
  if (!placingBack) {
    canPlace = frontId === BLOCK.AIR && !Engine.wouldCollideWithPlayer(state, tx, ty);
  } else {
    canPlace = backId === BLOCK.AIR;
  }

  if (slot && slot.id != null && canPlace) {
    const placeId = resolvePlacedId(slot.id);
    ctx.save();
    ctx.globalAlpha = placingBack ? 0.3 : 0.5;
    ctx.fillStyle = Engine.getBlockColor(placeId);
    if (placeId === BLOCK.WOOD_SLAB_BOTTOM) {
      ctx.fillRect(sx, sy + Engine.TILE_SIZE / 2, Engine.TILE_SIZE, Engine.TILE_SIZE / 2);
    } else if (placeId === BLOCK.WOOD_SLAB_TOP) {
      ctx.fillRect(sx, sy, Engine.TILE_SIZE, Engine.TILE_SIZE / 2);
    } else if (placeId === BLOCK.WOOD_STAIRS_L || placeId === BLOCK.WOOD_STAIRS_R) {
      ctx.beginPath();
      if (placeId === BLOCK.WOOD_STAIRS_L) {
        ctx.moveTo(sx, sy + Engine.TILE_SIZE);
        ctx.lineTo(sx + Engine.TILE_SIZE, sy + Engine.TILE_SIZE);
        ctx.lineTo(sx, sy);
      } else {
        ctx.moveTo(sx + Engine.TILE_SIZE, sy);
        ctx.lineTo(sx + Engine.TILE_SIZE, sy + Engine.TILE_SIZE);
        ctx.lineTo(sx, sy + Engine.TILE_SIZE);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(sx, sy, Engine.TILE_SIZE, Engine.TILE_SIZE);
    }
    ctx.restore();
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.strokeRect(sx + 2, sy + 2, Engine.TILE_SIZE - 4, Engine.TILE_SIZE - 4);
}

function drawRemotePlayers() {
  if (!state || remotePlayers.size === 0) return;
  const cam = Engine.getCamera(state, canvas);
  const camX = cam.x;
  const camY = cam.y;
  const w = 0.6 * Engine.TILE_SIZE;
  const h = 1.8 * Engine.TILE_SIZE;
  for (const [id, rp] of remotePlayers.entries()) {
    const px = rp.x * Engine.TILE_SIZE - camX - w / 2;
    const py = rp.y * Engine.TILE_SIZE - camY - h;
    ctx.fillStyle = id === 0 ? '#ffdb4d' : '#4dbbff';
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(px, py, w, h);
  }
}

let netStateTimer = 0;

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  if (dt > 0.05) dt = 0.05;
  lastTime = timestamp;

  if (!inMenu && state) {
    if (!paused && !inventoryOpen) {
      Engine.update(state, dt, moveSpeed);
    }
    Engine.draw(state, canvas, ctx);
    drawRemotePlayers();
    drawHoverHighlightAndPreview();
    updateHeartsUI(false);
    updateDebug(dt);

    if (isHost && state && hostServer) {
      const p = state.player;
      hostBroadcast({ type: 'state', id: 0, x: p.x, y: p.y }, null);
    }

    if (isClientConnected() && state) {
      netStateTimer += dt;
      if (netStateTimer > 0.05) {
        netStateTimer = 0;
        const p = state.player;
        clientSocket.send(JSON.stringify({ type: 'state', x: p.x, y: p.y }));
      }
    }
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(loop);
}

window.addEventListener('beforeunload', () => {
  saveWorld();
  stopNetworking();
});

function init() {
  setScreen('main');
  initHotbar();
  buildHearts();
  updateHeartsUI(true);
  buildInventoryUI();
  requestAnimationFrame(loop);
}

init();
