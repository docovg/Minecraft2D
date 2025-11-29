// src/worldgen.js
(function () {
  'use strict';

  const WORLD_HEIGHT = 96;
  const CHUNK_WIDTH = 32;

  const BLOCK = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    BEDROCK: 4,
    SAND: 5,
    SNOW: 6,
    LOG: 7,
    LEAVES: 8,
    COAL: 9,
    IRON: 10,
    GOLD: 11,
    DIAMOND: 12,
    PLANKS: 13,
    BED: 14,
    WOOD_STAIRS_L: 15,
    WOOD_STAIRS_R: 16,
    WOOD_SLAB_BOTTOM: 17,
    WOOD_SLAB_TOP: 18
  };

  let seed = 123456789 | 0;

  function seedFromString(str) {
    if (!str) str = 'default';
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    if (h === 0) h = 1234567;
    return h | 0;
  }

  function setSeedFromString(str) {
    seed = seedFromString(str);
  }

  function baseNoise(x, y) {
    let n = (x * 374761393 + y * 668265263 + seed) | 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = (n * 1274126177) >>> 0;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967296;
  }

  function smoothNoise1D(x, scale) {
    const xf = x / scale;
    const x0 = Math.floor(xf);
    const t = xf - x0;
    const a = baseNoise(x0, 0);
    const b = baseNoise(x0 + 1, 0);
    const tt = t * t * (3 - 2 * t);
    return a * (1 - tt) + b * tt;
  }

  function smoothNoise2D(x, y, scale) {
    const xf = x / scale;
    const yf = y / scale;
    const x0 = Math.floor(xf);
    const y0 = Math.floor(yf);
    const tx = xf - x0;
    const ty = yf - y0;

    const n00 = baseNoise(x0, y0);
    const n10 = baseNoise(x0 + 1, y0);
    const n01 = baseNoise(x0, y0 + 1);
    const n11 = baseNoise(x0 + 1, y0 + 1);

    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const ix0 = n00 * (1 - sx) + n10 * sx;
    const ix1 = n01 * (1 - sx) + n11 * sx;
    return ix0 * (1 - sy) + ix1 * sy;
  }

  function heightNoise(worldX) {
    const e =
      smoothNoise1D(worldX, 80) * 0.6 +
      smoothNoise1D(worldX, 160) * 0.3 +
      smoothNoise1D(worldX, 320) * 0.1;
    return e;
  }

  function biomeNoise(worldX) {
    return smoothNoise1D(worldX + 10000, 260);
  }

  function getSurfaceHeight(worldX) {
    const e = heightNoise(worldX);
    const base = Math.floor(WORLD_HEIGHT * 0.45);
    const amp = Math.floor(WORLD_HEIGHT * 0.18);
    let h = base + Math.round((e - 0.5) * 2 * amp);
    if (h < 12) h = 12;
    if (h > WORLD_HEIGHT - 20) h = WORLD_HEIGHT - 20;
    return h | 0;
  }

  function getBiome(worldX) {
    const v = biomeNoise(worldX);
    if (v < 0.18) return 'desert';
    if (v < 0.48) return 'plains';
    if (v < 0.78) return 'forest';
    return 'snow';
  }

  function caveNoise(worldX, y) {
    const n1 = smoothNoise2D(worldX, y, 22);
    const n2 = smoothNoise2D(worldX + 3000, y + 7000, 40);
    const n3 = smoothNoise2D(worldX - 5000, y * 2 + 9000, 80);
    return n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
  }

  function generateChunk(chunkX) {
    const blocks = new Array(CHUNK_WIDTH);
    const backBlocks = new Array(CHUNK_WIDTH);
    const surfaceByX = new Array(CHUNK_WIDTH);

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      blocks[lx] = new Array(WORLD_HEIGHT);
      backBlocks[lx] = new Array(WORLD_HEIGHT);
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const worldX = chunkX * CHUNK_WIDTH + lx;
      const biome = getBiome(worldX);
      const surfaceY = getSurfaceHeight(worldX);
      surfaceByX[lx] = surfaceY;

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let id = BLOCK.AIR;

        if (y < surfaceY) {
          id = BLOCK.AIR;
        } else {
          const depthFromSurface = y - surfaceY;

          if (y === WORLD_HEIGHT - 1) {
            id = BLOCK.BEDROCK;
          } else if (depthFromSurface === 0) {
            if (biome === 'desert') id = BLOCK.SAND;
            else if (biome === 'snow') id = BLOCK.SNOW;
            else id = BLOCK.GRASS;
          } else if (depthFromSurface <= 3) {
            if (biome === 'desert') id = BLOCK.SAND;
            else id = BLOCK.DIRT;
          } else {
            id = BLOCK.STONE;
          }
        }

        blocks[lx][y] = id;
      }
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const worldX = chunkX * CHUNK_WIDTH + lx;
      const surfaceY = surfaceByX[lx];

      for (let y = surfaceY + 4; y < WORLD_HEIGHT - 1; y++) {
        let id = blocks[lx][y];
        if (id !== BLOCK.STONE) continue;

        const heightFromBottom = (WORLD_HEIGHT - 1) - y;
        const r = baseNoise(worldX * 7, y * 11);

        if (heightFromBottom >= 4 && heightFromBottom <= 18 && r < 0.008) {
          id = BLOCK.DIAMOND;
        } else if (heightFromBottom >= 8 && heightFromBottom <= 26 && r < 0.015) {
          id = BLOCK.GOLD;
        } else if (heightFromBottom >= 10 && heightFromBottom <= 45 && r < 0.035) {
          id = BLOCK.IRON;
        } else if (heightFromBottom >= 12 && heightFromBottom <= 70 && r < 0.06) {
          id = BLOCK.COAL;
        }

        blocks[lx][y] = id;
      }
    }

    const caveFlags = new Array(CHUNK_WIDTH);
    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      caveFlags[lx] = new Array(WORLD_HEIGHT).fill(false);
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const worldX = chunkX * CHUNK_WIDTH + lx;
      const surfaceY = surfaceByX[lx];
      const caveStart = surfaceY + 10;

      for (let y = caveStart; y < WORLD_HEIGHT - 4; y++) {
        const id = blocks[lx][y];
        if (id === BLOCK.AIR || id === BLOCK.BEDROCK) continue;

        const depthFromSurface = y - caveStart;
        const maxDepth = (WORLD_HEIGHT - 4) - caveStart;
        const depthNorm = Math.max(0, Math.min(1, depthFromSurface / maxDepth));
        const density = caveNoise(worldX, y);

        const threshold = 0.70 - depthNorm * 0.22;

        if (density > threshold) {
          caveFlags[lx][y] = true;
        }
      }
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        if (!caveFlags[lx][y]) continue;
        let neighbours = 0;
        const nx = [1, -1, 0, 0];
        const ny = [0, 0, 1, -1];
        for (let i = 0; i < 4; i++) {
          const xx = lx + nx[i];
          const yy = y + ny[i];
          if (xx < 0 || xx >= CHUNK_WIDTH || yy < 0 || yy >= WORLD_HEIGHT) continue;
          if (caveFlags[xx][yy]) neighbours++;
        }
        if (neighbours >= 2) {
          blocks[lx][y] = BLOCK.AIR;
        }
      }
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const worldX = chunkX * CHUNK_WIDTH + lx;
      const biome = getBiome(worldX);
      const surfaceY = surfaceByX[lx];

      const treeAllowedBiome = (biome === 'plains' || biome === 'forest');
      const treeNoise = baseNoise(worldX, 1234);
      const treeDetail = baseNoise(worldX, 4321);
      const isTreeSpot = treeAllowedBiome && treeNoise > 0.7 && Math.abs(treeDetail - 0.5) < 0.18;

      const surfaceId = blocks[lx][surfaceY];
      const canGrowTree = (surfaceId === BLOCK.GRASS || surfaceId === BLOCK.SNOW);

      if (isTreeSpot && canGrowTree && lx >= 2 && lx <= CHUNK_WIDTH - 3) {
        const trunkHeight = 4 + ((worldX ^ seed) & 1);
        for (let i = 1; i <= trunkHeight; i++) {
          const ty = surfaceY - i;
          if (ty <= 1) break;
          if (blocks[lx][ty] === BLOCK.AIR) {
            blocks[lx][ty] = BLOCK.LOG;
          }
        }

        const leafTop = surfaceY - trunkHeight;
        for (let dx = -2; dx <= 2; dx++) {
          const tx = lx + dx;
          if (tx < 0 || tx >= CHUNK_WIDTH) continue;
          for (let dy = -2; dy <= 2; dy++) {
            const ty = leafTop + dy;
            if (ty < 0 || ty >= WORLD_HEIGHT) continue;
            if (Math.abs(dx) + Math.abs(dy) > 3) continue;
            if (blocks[tx][ty] === BLOCK.AIR) {
              blocks[tx][ty] = BLOCK.LEAVES;
            }
          }
        }
      }
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const surfaceY = surfaceByX[lx];
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let backId = BLOCK.AIR;
        const front = blocks[lx][y];

        if (y > surfaceY) {
          if (front !== BLOCK.AIR) {
            backId = front;
          } else {
            backId = BLOCK.STONE;
          }
        }

        if (y === WORLD_HEIGHT - 1) {
          backId = BLOCK.BEDROCK;
        }

        backBlocks[lx][y] = backId;
      }
    }

    return {
      chunkX,
      blocks,
      backBlocks
    };
  }

  window.WorldGen = {
    WORLD_HEIGHT,
    CHUNK_WIDTH,
    BLOCK,
    setSeed: setSeedFromString,
    getSurfaceHeight,
    generateChunk
  };
})();
