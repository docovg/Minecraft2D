// Core engine: world access, physics, and rendering

(function () {
  'use strict';

  const TILE_SIZE = 32;
  const WORLD_HEIGHT = WorldGen.WORLD_HEIGHT;
  const CHUNK_WIDTH = WorldGen.CHUNK_WIDTH;
  const BLOCK = WorldGen.BLOCK;

  const GRAVITY = 30;
  const MOVE_SPEED = 7;
  const JUMP_SPEED = 13;
  const MAX_FALL_SPEED = 40;

  function getBlockColor(id) {
    if (id === BLOCK.GRASS) return '#3ca341';
    if (id === BLOCK.DIRT) return '#8a5a2b';
    if (id === BLOCK.STONE) return '#777777';
    if (id === BLOCK.BEDROCK) return '#222222';
    if (id === BLOCK.COAL) return '#262626';
    if (id === BLOCK.IRON) return '#c0c0c0';
    if (id === BLOCK.GOLD) return '#ffd700';
    if (id === BLOCK.DIAMOND) return '#00c8ff';
    return '#000000';
  }

  function isSolid(id) {
    return id !== BLOCK.AIR;
  }

  function createState(seedString) {
    WorldGen.setSeed(seedString || 'default');
    const chunks = new Map();

    const state = {
      seed: seedString || 'default',
      chunks,
      player: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        w: 0.6,
        h: 1.8,
        onGround: false,
        health: 20
      },
      input: {
        left: false,
        right: false,
        jumpQueued: false
      },
      time: 0
    };

    const spawnX = 0;
    const surfaceY = WorldGen.getSurfaceHeight(spawnX);
    state.player.x = spawnX + 0.5;
    state.player.y = surfaceY - 1;

    return state;
  }

  function getChunk(state, chunkX) {
    let chunk = state.chunks.get(chunkX);
    if (!chunk) {
      chunk = WorldGen.generateChunk(chunkX);
      state.chunks.set(chunkX, chunk);
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

  function update(state, dt) {
    const p = state.player;
    state.time += dt;

    let move = 0;
    if (state.input.left) move -= 1;
    if (state.input.right) move += 1;

    p.vx = move * MOVE_SPEED;

    if (state.input.jumpQueued && p.onGround) {
      p.vy = -JUMP_SPEED;
      p.onGround = false;
    }
    state.input.jumpQueued = false;

    p.vy += GRAVITY * dt;
    if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;

    // Horizontal movement with collision
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

    // Vertical movement with collision
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

    if (p.y > WORLD_HEIGHT + 10) {
      const surface = WorldGen.getSurfaceHeight(Math.round(p.x));
      p.x = Math.round(p.x) + 0.5;
      p.y = surface - 1;
      p.vx = 0;
      p.vy = 0;
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

    const dayT = (Math.sin(state.time * 0.05) + 1) / 2;
    const skyR = Math.round(20 + (100 - 20) * dayT);
    const skyG = Math.round(40 + (180 - 40) * dayT);
    const skyB = Math.round(80 + (240 - 80) * dayT);
    ctx.fillStyle = 'rgb(' + skyR + ',' + skyG + ',' + skyB + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = Math.floor(camX / TILE_SIZE) - 2;
    const endX = Math.floor((camX + canvas.width) / TILE_SIZE) + 2;
    const startY = Math.max(0, Math.floor(camY / TILE_SIZE) - 2);
    const endY = Math.min(WORLD_HEIGHT, Math.floor((camY + canvas.height) / TILE_SIZE) + 2);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y < endY; y++) {
        const id = getBlock(state, x, y);
        if (id !== BLOCK.AIR) {
          const sx = x * TILE_SIZE - camX;
          const sy = y * TILE_SIZE - camY;
          ctx.fillStyle = getBlockColor(id);
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
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
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(px, py, p.w * TILE_SIZE, p.h * TILE_SIZE);
  }

  window.Engine = {
    TILE_SIZE,
    WORLD_HEIGHT,
    CHUNK_WIDTH,
    BLOCK,
    createState,
    getBlock,
    setBlock,
    update,
    draw
  };
})();
