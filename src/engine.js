// src/engine.js
(function () {
  'use strict';

  const TILE_SIZE = 32;
  const WORLD_HEIGHT = WorldGen.WORLD_HEIGHT;
  const CHUNK_WIDTH = WorldGen.CHUNK_WIDTH;
  const BLOCK = WorldGen.BLOCK;

  const GRAVITY = 30;
  const SAFE_FALL_SPEED = 14;
  const FALL_DAMAGE_FACTOR = 1.5;
  const MAX_FALL_SPEED = 40;

  const textures = {};
  (function initTextures() {
    const base = 'textures/';
    const mapping = {};
    mapping[BLOCK.SAND] = 'sand.png';
    mapping[BLOCK.LOG] = 'oak.png';
    mapping[BLOCK.PLANKS] = 'planks.png';
    mapping[BLOCK.LEAVES] = 'leaves.png';
    mapping[BLOCK.STONE] = 'stone.png';
    mapping[BLOCK.BEDROCK] = 'bedrock.png';
    mapping[BLOCK.DIAMOND] = 'diamond_ore.png';
    mapping[BLOCK.DIRT] = 'dirt.png';
    mapping[BLOCK.GRASS] = 'grass_block_side.png';
    mapping[BLOCK.SNOW] = 'grass_block_snow.png';
    for (const k in mapping) {
      const img = new Image();
      img.src = base + mapping[k];
      textures[k] = img;
    }
  })();

  function getBlockColor(id) {
    if (id === BLOCK.GRASS) return '#3ca341';
    if (id === BLOCK.DIRT) return '#8a5a2b';
    if (id === BLOCK.STONE) return '#777777';
    if (id === BLOCK.BEDROCK) return '#222222';
    if (id === BLOCK.SAND) return '#e0d189';
    if (id === BLOCK.SNOW) return '#f5f9ff';
    if (id === BLOCK.LOG) return '#b47a3c';
    if (id === BLOCK.LEAVES) return '#2e8b57';
    if (id === BLOCK.COAL) return '#262626';
    if (id === BLOCK.IRON) return '#c0c0c0';
    if (id === BLOCK.GOLD) return '#ffd700';
    if (id === BLOCK.DIAMOND) return '#00c8ff';
    if (id === BLOCK.PLANKS) return '#c89f6c';
    if (id === BLOCK.BED) return '#d13b3b';
    if (id === BLOCK.WOOD_STAIRS_L || id === BLOCK.WOOD_STAIRS_R) return '#b88452';
    if (id === BLOCK.WOOD_SLAB_BOTTOM || id === BLOCK.WOOD_SLAB_TOP) return '#d3a86b';
    return '#000000';
  }

  function isSolid(id) {
    return id !== BLOCK.AIR;
  }

  function createState(seedString, difficulty, creative) {
    WorldGen.setSeed(seedString || 'default');

    const chunks = new Map();
    const surface = WorldGen.getSurfaceHeight(0);

    const state = {
      seed: seedString || 'default',
      difficulty: difficulty || 'normal',
      creative: !!creative,
      chunks,
      player: {
        x: 0.5,
        y: surface - 1,
        vx: 0,
        vy: 0,
        w: 0.6,
        h: 1.8,
        onGround: false,
        health: 20,
        maxHealth: 20
      },
      input: {
        left: false,
        right: false,
        jumpQueued: false
      },
      time: 0
    };

    return state;
  }

  function ensureBackLayer(chunk) {
    if (chunk.backBlocks) return;
    const back = new Array(CHUNK_WIDTH);
    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      back[lx] = new Array(WORLD_HEIGHT);
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        back[lx][y] = BLOCK.AIR;
      }
    }
    chunk.backBlocks = back;
  }

  function getChunk(state, chunkX) {
    let chunk = state.chunks.get(chunkX);
    if (!chunk) {
      chunk = WorldGen.generateChunk(chunkX);
      state.chunks.set(chunkX, chunk);
    } else if (!chunk.backBlocks) {
      ensureBackLayer(chunk);
    }
    return chunk;
  }

  function getBlock(state, x, y) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cX = Math.floor(x / CHUNK_WIDTH);
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const chunk = getChunk(state, cX);
    return chunk.blocks[localX][y] || BLOCK.AIR;
  }

  function setBlock(state, x, y, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cX = Math.floor(x / CHUNK_WIDTH);
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const chunk = getChunk(state, cX);
    chunk.blocks[localX][y] = id;
  }

  function getBackBlock(state, x, y) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cX = Math.floor(x / CHUNK_WIDTH);
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const chunk = getChunk(state, cX);
    if (!chunk.backBlocks) return BLOCK.AIR;
    return chunk.backBlocks[localX][y] || BLOCK.AIR;
  }

  function setBackBlock(state, x, y, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cX = Math.floor(x / CHUNK_WIDTH);
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const chunk = getChunk(state, cX);
    if (!chunk.backBlocks) ensureBackLayer(chunk);
    chunk.backBlocks[localX][y] = id;
  }

  function applyDamage(state, amount) {
    if (state.creative) return;
    state.player.health -= amount;
    if (state.player.health <= 0) {
      state.player.health = state.player.maxHealth;
      const surface = WorldGen.getSurfaceHeight(0);
      state.player.x = 0.5;
      state.player.y = surface - 1;
      state.player.vx = 0;
      state.player.vy = 0;
    }
  }

  function update(state, dt, moveSpeed) {
    const p = state.player;
    state.time += dt;

    let move = 0;
    if (state.input.left) move -= 1;
    if (state.input.right) move += 1;

    const speed = moveSpeed || 7;
    p.vx = move * speed;

    if (state.input.jumpQueued && p.onGround) {
      p.vy = -13;
      p.onGround = false;
    }
    state.input.jumpQueued = false;

    p.vy += GRAVITY * dt;
    if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;

    let newX = p.x + p.vx * dt;
    const fromY = Math.floor(p.y - p.h + 0.001);
    const toY = Math.floor(p.y - 0.001);

    if (p.vx > 0) {
      const right = newX + p.w / 2;
      const rightTile = Math.floor(right - 0.001);
      for (let y = fromY; y <= toY; y++) {
        if (isSolid(getBlock(state, rightTile, y))) {
          newX = rightTile - p.w / 2;
          break;
        }
      }
    } else if (p.vx < 0) {
      const left = newX - p.w / 2;
      const leftTile = Math.floor(left + 0.001);
      for (let y = fromY; y <= toY; y++) {
        if (isSolid(getBlock(state, leftTile, y))) {
          newX = leftTile + 1 + p.w / 2;
          break;
        }
      }
    }
    p.x = newX;

    const oldVy = p.vy;
    let newY = p.y + p.vy * dt;
    p.onGround = false;

    if (p.vy > 0) {
      const bottom = newY;
      const bottomTile = Math.floor(bottom - 0.001);
      const fromX = Math.floor(p.x - p.w / 2 + 0.001);
      const toX = Math.floor(p.x + p.w / 2 - 0.001);
      for (let x = fromX; x <= toX; x++) {
        if (isSolid(getBlock(state, x, bottomTile))) {
          newY = bottomTile;
          p.vy = 0;
          p.onGround = true;
          break;
        }
      }
    } else if (p.vy < 0) {
      const top = newY - p.h;
      const topTile = Math.floor(top + 0.001);
      const fromX = Math.floor(p.x - p.w / 2 + 0.001);
      const toX = Math.floor(p.x + p.w / 2 - 0.001);
      for (let x = fromX; x <= toX; x++) {
        if (isSolid(getBlock(state, x, topTile))) {
          newY = topTile + 1 + p.h;
          p.vy = 0;
          break;
        }
      }
    }
    p.y = newY;

    if (p.onGround && oldVy > SAFE_FALL_SPEED) {
      const dmg = (oldVy - SAFE_FALL_SPEED) * FALL_DAMAGE_FACTOR;
      if (state.difficulty !== 'peaceful') {
        applyDamage(state, dmg);
      }
    }

    if (p.y > WORLD_HEIGHT + 10) {
      applyDamage(state, 999);
    }
  }

  function getCamera(state, canvas) {
    const p = state.player;
    let camX = p.x * TILE_SIZE - canvas.width / 2;
    let camY = (p.y - p.h / 2) * TILE_SIZE - canvas.height / 2;
    return { x: camX, y: camY };
  }

  function draw(state, canvas, ctx) {
    const cam = getCamera(state, canvas);
    const camX = cam.x;
    const camY = cam.y;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const t = (Math.sin(state.time * 0.05) + 1) / 2;
    const r = Math.round(20 + (120 - 20) * t);
    const g = Math.round(40 + (190 - 40) * t);
    const b = Math.round(80 + (240 - 80) * t);
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = Math.floor(camX / TILE_SIZE) - 2;
    const endX = Math.floor((camX + canvas.width) / TILE_SIZE) + 2;
    const startY = Math.max(0, Math.floor(camY / TILE_SIZE) - 2);
    const endY = Math.min(WORLD_HEIGHT, Math.floor((camY + canvas.height) / TILE_SIZE) + 2);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y < endY; y++) {
        const sx = x * TILE_SIZE - camX;
        const sy = y * TILE_SIZE - camY;
        const frontId = getBlock(state, x, y);
        const backId = getBackBlock(state, x, y);

        if (frontId === BLOCK.AIR && backId !== BLOCK.AIR) {
          const texB = textures[backId];
          ctx.save();
          ctx.globalAlpha = 0.45;
          if (texB && texB.complete && texB.naturalWidth) {
            ctx.drawImage(texB, sx, sy, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = getBlockColor(backId);
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          }
          ctx.restore();
        }

        if (frontId !== BLOCK.AIR) {
          const id = frontId;
          const tex = textures[id];

          if (
            id === BLOCK.WOOD_SLAB_BOTTOM ||
            id === BLOCK.WOOD_SLAB_TOP ||
            id === BLOCK.WOOD_STAIRS_L ||
            id === BLOCK.WOOD_STAIRS_R
          ) {
            const color = getBlockColor(id);
            ctx.fillStyle = color;

            if (id === BLOCK.WOOD_SLAB_BOTTOM) {
              ctx.fillRect(sx, sy + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);
            } else if (id === BLOCK.WOOD_SLAB_TOP) {
              ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE / 2);
            } else if (id === BLOCK.WOOD_STAIRS_L || id === BLOCK.WOOD_STAIRS_R) {
              ctx.beginPath();
              if (id === BLOCK.WOOD_STAIRS_L) {
                ctx.moveTo(sx, sy + TILE_SIZE);
                ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
                ctx.lineTo(sx, sy);
              } else {
                ctx.moveTo(sx + TILE_SIZE, sy);
                ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
                ctx.lineTo(sx, sy + TILE_SIZE);
              }
              ctx.closePath();
              ctx.fill();
            }
          } else {
            if (tex && tex.complete && tex.naturalWidth) {
              ctx.drawImage(tex, sx, sy, TILE_SIZE, TILE_SIZE);
            } else {
              ctx.fillStyle = getBlockColor(id);
              ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            }
          }

          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    const p = state.player;
    const px = p.x * TILE_SIZE - camX - p.w * TILE_SIZE / 2;
    const py = p.y * TILE_SIZE - camY - p.h * TILE_SIZE;
    ctx.fillStyle = '#ffd39f';
    ctx.fillRect(px, py, p.w * TILE_SIZE, p.h * TILE_SIZE);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(px, py, p.w * TILE_SIZE, p.h * TILE_SIZE);
  }

  function wouldCollideWithPlayer(state, tx, ty) {
    const p = state.player;
    const bx1 = tx, by1 = ty, bx2 = tx + 1, by2 = ty + 1;
    const px1 = p.x - p.w / 2;
    const py1 = p.y - p.h;
    const px2 = p.x + p.w / 2;
    const py2 = p.y;
    if (bx2 <= px1 || bx1 >= px2 || by2 <= py1 || by1 >= py2) return false;
    return true;
  }

  window.Engine = {
    TILE_SIZE,
    WORLD_HEIGHT,
    CHUNK_WIDTH,
    BLOCK,
    createState,
    getBlock,
    setBlock,
    getBackBlock,
    setBackBlock,
    update,
    draw,
    getCamera,
    wouldCollideWithPlayer,
    getBlockColor
  };
})();
