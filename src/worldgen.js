// Procedural 2D terrain generation, Minecraft-like, infinite in X

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
    COAL: 5,
    IRON: 6,
    GOLD: 7,
    DIAMOND: 8
  };

  let seed = 123456789 | 0;

  function setSeedFromString(str) {
    if (!str) str = 'default';
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    if (h === 0) h = 1234567;
    seed = h | 0;
  }

  // 1D integer noise based on seed
  function noiseInt(i) {
    let n = (i * 374761393 + seed * 668265263) | 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = (n * 1274126177) >>> 0;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967296; // [0,1)
  }

  // Smooth interpolated noise for float x
  function smoothNoise(x) {
    const xi = Math.floor(x);
    const t = x - xi;
    const a = noiseInt(xi);
    const b = noiseInt(xi + 1);
    const tt = t * t * (3 - 2 * t); // smoothstep
    return a * (1 - tt) + b * tt;
  }

  // Fractal noise for height field
  function heightNoise(worldX) {
    const nx = worldX / 48; // horizontal scale
    let e =
      smoothNoise(nx) * 0.6 +
      smoothNoise(nx * 0.5) * 0.3 +
      smoothNoise(nx * 0.25) * 0.1;
    return e; // ~[0,1]
  }

  function getSurfaceHeight(worldX) {
    const e = heightNoise(worldX);
    const base = WORLD_HEIGHT * 0.45;
    const amp = WORLD_HEIGHT * 0.12;
    let h = base + (e - 0.5) * 2 * amp;
    if (h < WORLD_HEIGHT * 0.2) h = WORLD_HEIGHT * 0.2;
    if (h > WORLD_HEIGHT * 0.8) h = WORLD_HEIGHT * 0.8;
    return (h | 0);
  }

  function oreNoise(worldX, y, offset) {
    // pseudo-random per (x,y) for ores
    const i = worldX * 734287 + y * 912285 + offset * 19937;
    return noiseInt(i);
  }

  function generateChunk(chunkX) {
    const blocks = new Array(CHUNK_WIDTH);
    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      blocks[lx] = new Array(WORLD_HEIGHT);
    }

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const worldX = chunkX * CHUNK_WIDTH + lx;
      const surfaceY = getSurfaceHeight(worldX);

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let id = BLOCK.AIR;

        if (y === WORLD_HEIGHT - 1) {
          id = BLOCK.BEDROCK;
        } else if (y > surfaceY + 4) {
          // Deep stone + ores
          id = BLOCK.STONE;
          const depth = (WORLD_HEIGHT - 1) - y;
          const r = oreNoise(worldX, y, 1);
          if (depth > 12 && depth < 40 && r < 0.04) {
            id = BLOCK.COAL;
          } else if (depth > 20 && depth < 50 && r >= 0.04 && r < 0.07) {
            id = BLOCK.IRON;
          } else if (depth > 30 && r >= 0.07 && r < 0.085) {
            id = BLOCK.GOLD;
          } else if (depth > 40 && r >= 0.085 && r < 0.095) {
            id = BLOCK.DIAMOND;
          }
        } else if (y > surfaceY) {
          // Dirt layer
          id = BLOCK.DIRT;
        } else if (y === surfaceY) {
          // Grass top
          id = BLOCK.GRASS;
        } else {
          // Air above surface
          id = BLOCK.AIR;
        }

        blocks[lx][y] = id;
      }
    }

    return {
      chunkX,
      blocks
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
