/* ============================================================
 *  坦克大战 · 经典闯关
 *  纯 Canvas 2D 实现，无任何外部资源依赖（图形与音效全部程序化生成）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const CELL = 16;
  const COLS = 26;
  const ROWS = 26;
  const W = COLS * CELL; // 416
  const H = ROWS * CELL; // 416
  const TANK = 32;
  const BULLET = 6;
  const BASE_C = 12; // 基地左上角单元列
  const BASE_R = 24; // 基地左上角单元行

  const T = { EMPTY: 0, BRICK: 1, STEEL: 2, GRASS: 3, WATER: 4, BASE: 5 };
  const LEGEND = { '.': T.EMPTY, '#': T.BRICK, '@': T.STEEL, '*': T.GRASS, '~': T.WATER, 'B': T.BASE };

  const DIRS = {
    up: { x: 0, y: -1, ang: 0 },
    right: { x: 1, y: 0, ang: Math.PI / 2 },
    down: { x: 0, y: 1, ang: Math.PI },
    left: { x: -1, y: 0, ang: -Math.PI / 2 }
  };
  const DIR_KEYS = ['up', 'right', 'down', 'left'];

  const ENEMY_TYPES = {
    basic: { speed: 48, hp: 1, bulletSpeed: 170, fireDelay: 1.0, score: 100, color: '#8d99a6', dark: '#5d6873', light: '#c3ccd6' },
    fast: { speed: 82, hp: 1, bulletSpeed: 190, fireDelay: 1.25, score: 200, color: '#5fc4e8', dark: '#2f7f9c', light: '#bdeaff' },
    power: { speed: 52, hp: 1, bulletSpeed: 265, fireDelay: 0.72, score: 300, color: '#79cf68', dark: '#3f8a35', light: '#c7f2bd' },
    armor: { speed: 44, hp: 4, bulletSpeed: 185, fireDelay: 0.85, score: 400, color: '#d9a04a', dark: '#8f6520', light: '#f6d79a' }
  };

  /* ---------------- DOM / 画布 ---------------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hudStage = document.getElementById('hud-stage');
  const hudLives = document.getElementById('hud-lives');
  const hudEnemies = document.getElementById('hud-enemies');
  const hudScore = document.getElementById('hud-score');
  const overlay = document.getElementById('overlay');
  const overlayInner = document.getElementById('overlay-inner');
  const stickEl = document.getElementById('stick');
  const knobEl = document.getElementById('stick-knob');
  const fireBtn = document.getElementById('fire');
  const pauseBtn = document.getElementById('pause');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const availW = window.innerWidth - 6;
    const availH = window.innerHeight - 40; // 顶部留出 HUD 空间
    const size = Math.max(180, Math.min(availW, availH));
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const s = canvas.width / W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  /* ---------------- 工具 ---------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const cellIndex = (c, r) => r * COLS + c;
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function gridAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return T.STEEL;
    return grid[cellIndex(c, r)];
  }

  /* ---------------- 游戏状态 ---------------- */
  const game = {
    state: 'title', // title | playing | paused | clear | over
    stage: 1,
    score: 0,
    lives: 3
  };

  let grid = new Uint8Array(COLS * ROWS);
  let tanks = [];
  let bullets = [];
  let items = [];
  let particles = [];
  let player = null;

  let toSpawn = 0;
  let maxActive = 4;
  let spawnTimer = 0;
  let enemyIndex = 0;
  let enemyCfg = null;
  let respawnT = 0;
  let stageClearT = 0;
  let baseAlive = true;
  let time = 0;
  let banner = null;

  let shovelT = 0;
  let shovelCells = [];

  let waterCells = [];
  let grassCells = [];

  let wallCanvas = null;
  let wallCtx = null;
  let grassCanvas = null;
  let grassCtx = null;

  /* ---------------- 地图 / 关卡 ---------------- */
  function stageConfig(stage) {
    return {
      total: Math.min(20, 8 + stage * 2),
      maxActive: Math.min(5, 3 + Math.floor((stage - 1) / 2)),
      armorChance: Math.min(0.3, 0.04 + stage * 0.035),
      fastChance: Math.min(0.35, 0.12 + stage * 0.03),
      powerChance: Math.min(0.3, 0.1 + stage * 0.03)
    };
  }

  function pickEnemyType() {
    const r = Math.random();
    let acc = 0;
    acc += enemyCfg.armorChance;
    if (r < acc) return 'armor';
    acc += enemyCfg.powerChance;
    if (r < acc) return 'power';
    acc += enemyCfg.fastChance;
    if (r < acc) return 'fast';
    return 'basic';
  }

  function buildCaches() {
    waterCells = [];
    grassCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[cellIndex(c, r)];
        if (v === T.WATER) waterCells.push([c, r]);
        else if (v === T.GRASS) grassCells.push([c, r]);
      }
    }

    if (!wallCanvas) {
      wallCanvas = document.createElement('canvas');
      wallCanvas.width = W;
      wallCanvas.height = H;
      wallCtx = wallCanvas.getContext('2d');
    }
    if (!grassCanvas) {
      grassCanvas = document.createElement('canvas');
      grassCanvas.width = W;
      grassCanvas.height = H;
      grassCtx = grassCanvas.getContext('2d');
    }
    rebuildWalls();
    rebuildGrass();
  }

  function rebuildWalls() {
    wallCtx.clearRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[cellIndex(c, r)];
        if (v === T.BRICK) drawBrick(wallCtx, c, r);
        else if (v === T.STEEL) drawSteel(wallCtx, c, r);
      }
    }
  }

  function rebuildGrass() {
    grassCtx.clearRect(0, 0, W, H);
    for (let i = 0; i < grassCells.length; i++) {
      const c = grassCells[i][0];
      const r = grassCells[i][1];
      drawGrassTile(grassCtx, c, r);
    }
  }

  function loadStage() {
    const map = window.MAPS[(game.stage - 1) % window.MAPS.length];
    grid = new Uint8Array(COLS * ROWS);

    for (let r = 0; r < 13; r++) {
      const row = map.grid[r] || '.............';
      for (let c = 0; c < 13; c++) {
        const ch = row[c] || '.';
        const v = LEGEND[ch] !== undefined ? LEGEND[ch] : T.EMPTY;
        if (v === T.EMPTY) continue;
        for (let dr = 0; dr < 2; dr++) {
          for (let dc = 0; dc < 2; dc++) {
            grid[cellIndex(c * 2 + dc, r * 2 + dr)] = v;
          }
        }
      }
    }

    baseAlive = true;
    buildCaches();

    tanks = [];
    bullets = [];
    items = [];
    particles = [];
    player = null;
    shovelCells = [];
    shovelT = 0;

    enemyCfg = stageConfig(game.stage);
    toSpawn = enemyCfg.total;
    maxActive = enemyCfg.maxActive;
    spawnTimer = 0.9;
    enemyIndex = 0;
    respawnT = 0;
    stageClearT = 0;

    spawnPlayer(3);

    banner = { text: 'STAGE ' + game.stage, sub: map.name, t: 1.9 };
    game.state = 'playing';
    hideOverlay();
    updateHud();
    if (window.SFX) SFX.stageStart();
  }

  /* ---------------- 坦克 ---------------- */
  function makeTank(cfg) {
    return {
      x: cfg.x,
      y: cfg.y,
      dir: cfg.dir || 'up',
      speed: cfg.speed,
      maxBullets: cfg.maxBullets || 1,
      bulletSpeed: cfg.bulletSpeed,
      fireDelay: cfg.fireDelay,
      cooldown: 0,
      hp: cfg.hp || 1,
      maxHp: cfg.hp || 1,
      isPlayer: !!cfg.isPlayer,
      type: cfg.type || 'basic',
      alive: true,
      shield: 0,
      star: 0,
      power: 1,
      flash: 0,
      aiT: 0,
      shootT: 0.7 + Math.random() * 1.1,
      frozenT: 0,
      carriesItem: false
    };
  }

  function spawnPlayer(shield) {
    const p = makeTank({
      x: 128,
      y: 384,
      dir: 'up',
      speed: 108,
      maxBullets: 1,
      bulletSpeed: 250,
      fireDelay: 0.28,
      isPlayer: true
    });
    p.shield = shield || 0;
    tanks.push(p);
    player = p;
    explode(p.x + 16, p.y + 16, false, 0.8);
  }

  function applyStarLevel(p) {
    p.maxBullets = p.star >= 2 ? 2 : 1;
    p.bulletSpeed = p.star >= 1 ? 340 : 250;
    p.power = p.star >= 3 ? 2 : 1;
    p.fireDelay = p.star >= 1 ? 0.22 : 0.28;
  }

  function blocked(t, x, y) {
    if (x < 0 || y < 0 || x + TANK > W || y + TANK > H) return true;
    const c0 = Math.floor(x / CELL);
    const c1 = Math.floor((x + TANK - 0.01) / CELL);
    const r0 = Math.floor(y / CELL);
    const r1 = Math.floor((y + TANK - 0.01) / CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = gridAt(c, r);
        if (v === T.BRICK || v === T.STEEL || v === T.WATER || v === T.BASE) return true;
      }
    }
    for (let i = 0; i < tanks.length; i++) {
      const o = tanks[i];
      if (o === t || !o.alive) continue;
      if (rectsOverlap(x, y, TANK, TANK, o.x, o.y, TANK, TANK)) return true;
    }
    return false;
  }

  function snappedPos(t, dir) {
    const d = DIRS[dir];
    let x = t.x;
    let y = t.y;
    if (d.x !== 0) y = clamp(Math.round(y / 8) * 8, 0, H - TANK);
    else x = clamp(Math.round(x / 8) * 8, 0, W - TANK);
    return { x: x, y: y };
  }

  function canMoveDir(t, dir) {
    const p = snappedPos(t, dir);
    return !blocked(t, p.x + DIRS[dir].x * 2, p.y + DIRS[dir].y * 2);
  }

  function moveTank(t, dir, dt) {
    const d = DIRS[dir];
    if (t.dir !== dir) {
      const ox = t.x;
      const oy = t.y;
      t.dir = dir;
      const sp = snappedPos(t, dir);
      t.x = sp.x;
      t.y = sp.y;
      if (blocked(t, t.x, t.y)) {
        t.x = ox;
        t.y = oy;
      }
    }
    const step = t.speed * dt;
    const nx = t.x + d.x * step;
    const ny = t.y + d.y * step;
    if (!blocked(t, nx, ny)) {
      t.x = nx;
      t.y = ny;
      return true;
    }
    return false;
  }

  function fire(t) {
    if (t.cooldown > 0 || !t.alive) return;
    let mine = 0;
    for (let i = 0; i < bullets.length; i++) {
      if (bullets[i].owner === t) mine++;
    }
    if (mine >= t.maxBullets) return;

    t.cooldown = t.fireDelay;
    const d = DIRS[t.dir];
    const cx = t.x + TANK / 2 + d.x * (TANK / 2 + 2);
    const cy = t.y + TANK / 2 + d.y * (TANK / 2 + 2);
    bullets.push({
      x: cx - BULLET / 2,
      y: cy - BULLET / 2,
      dir: t.dir,
      speed: t.bulletSpeed,
      owner: t,
      fromPlayer: !!t.isPlayer,
      power: t.power || 1,
      alive: true
    });
    spark(cx, cy, 3);
    if (window.SFX) SFX.shoot();
  }

  /* ---------------- 玩家 ---------------- */
  function updatePlayer(dt) {
    const p = player;
    if (!p || !p.alive) return;
    if (p.cooldown > 0) p.cooldown -= dt;
    if (p.shield > 0) p.shield -= dt;
    if (p.flash > 0) p.flash -= dt;

    const dir = getInputDir();
    if (dir) moveTank(p, dir, dt);
    if (isFiring()) fire(p);
  }

  function killPlayer() {
    const p = player;
    if (!p) return;
    p.alive = false;
    explode(p.x + 16, p.y + 16, true, 1.7);
    if (window.SFX) SFX.explode(true);
    player = null;
    game.lives -= 1;
    updateHud();
    if (game.lives > 0) {
      respawnT = 1.5;
    } else {
      gameOver('坦克全部损毁');
    }
  }

  /* ---------------- 敌人 AI ---------------- */
  function pickTarget(t) {
    if (player && player.alive && Math.random() < 0.45) {
      return { x: player.x + 16, y: player.y + 16 };
    }
    if (baseAlive) return { x: BASE_C * CELL + 16, y: BASE_R * CELL + 16 };
    if (player && player.alive) return { x: player.x + 16, y: player.y + 16 };
    return { x: W / 2, y: H / 2 };
  }

  function chooseDir(e) {
    const pref = [];
    if (Math.random() < 0.58) {
      const tg = pickTarget(e);
      const dx = tg.x - (e.x + 16);
      const dy = tg.y - (e.y + 16);
      const horiz = dx > 0 ? 'right' : 'left';
      const vert = dy > 0 ? 'down' : 'up';
      if (Math.abs(dx) > Math.abs(dy)) pref.push(horiz, vert);
      else pref.push(vert, horiz);
      for (let i = 0; i < DIR_KEYS.length; i++) {
        if (pref.indexOf(DIR_KEYS[i]) < 0) pref.push(DIR_KEYS[i]);
      }
    } else {
      for (let i = 0; i < DIR_KEYS.length; i++) pref.push(DIR_KEYS[i]);
      for (let i = pref.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = pref[i];
        pref[i] = pref[j];
        pref[j] = tmp;
      }
    }
    for (let i = 0; i < pref.length; i++) {
      if (pref[i] !== e.dir && canMoveDir(e, pref[i])) return pref[i];
    }
    return pref[0];
  }

  function aimAligned(e) {
    const targets = [];
    if (player && player.alive) targets.push({ x: player.x + 16, y: player.y + 16 });
    if (baseAlive) targets.push({ x: BASE_C * CELL + 16, y: BASE_R * CELL + 16 });
    for (let i = 0; i < targets.length; i++) {
      const dx = Math.abs(targets[i].x - (e.x + 16));
      const dy = Math.abs(targets[i].y - (e.y + 16));
      if (e.dir === 'up' || e.dir === 'down') {
        if (dx < 20) return true;
      } else {
        if (dy < 20) return true;
      }
    }
    return false;
  }

  function updateEnemy(e, dt) {
    if (e.cooldown > 0) e.cooldown -= dt;
    if (e.shield > 0) e.shield -= dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.frozenT > 0) {
      e.frozenT -= dt;
      return;
    }
    e.aiT -= dt;
    if (e.aiT <= 0) {
      e.aiT = 0.35 + Math.random() * 0.95;
      e.dir = chooseDir(e);
    }
    if (!moveTank(e, e.dir, dt)) {
      e.dir = chooseDir(e);
      e.aiT = 0.3 + Math.random() * 0.5;
    }
    e.shootT -= dt;
    if (e.shootT <= 0) {
      e.shootT = 0.45 + Math.random() * 1.05;
      if (Math.random() < 0.6 || aimAligned(e)) fire(e);
    }
  }

  function spawnEnemy() {
    const pts = [[0, 0], [192, 0], [384, 0]];
    const free = [];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0];
      const y = pts[i][1];
      let occupied = false;
      for (let j = 0; j < tanks.length; j++) {
        if (tanks[j].alive && rectsOverlap(x, y, TANK, TANK, tanks[j].x, tanks[j].y, TANK, TANK)) {
          occupied = true;
          break;
        }
      }
      if (!occupied) free.push(pts[i]);
    }
    if (!free.length) return;

    const p = free[(Math.random() * free.length) | 0];
    const type = pickEnemyType();
    const cfg = ENEMY_TYPES[type];
    const e = makeTank({
      x: p[0],
      y: p[1],
      dir: 'down',
      speed: cfg.speed,
      hp: cfg.hp,
      maxBullets: type === 'power' ? 2 : 1,
      bulletSpeed: cfg.bulletSpeed,
      fireDelay: cfg.fireDelay,
      type: type
    });
    e.shield = 0.85;
    e.carriesItem = enemyIndex > 0 && enemyIndex % 4 === 0;
    tanks.push(e);
    enemyIndex++;
    toSpawn--;
    explode(p[0] + 16, p[1] + 16, false, 0.9);
  }

  function updateSpawn(dt) {
    if (toSpawn <= 0) return;
    spawnTimer -= dt;
    if (spawnTimer > 0) return;
    let active = 0;
    for (let i = 0; i < tanks.length; i++) {
      if (tanks[i].alive && !tanks[i].isPlayer) active++;
    }
    if (active >= maxActive) return;
    spawnEnemy();
    spawnTimer = Math.max(0.65, 1.55 - game.stage * 0.07);
  }

  function killEnemy(e) {
    e.alive = false;
    explode(e.x + 16, e.y + 16, true, 1.5);
    if (window.SFX) SFX.explode(true);
    addScore(ENEMY_TYPES[e.type].score);
    if (e.carriesItem) dropItem();
  }

  /* ---------------- 子弹 ---------------- */
  function updateBullets(dt) {
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b.alive) continue;
      const d = DIRS[b.dir];
      let remain = b.speed * dt;
      while (remain > 0 && b.alive) {
        const step = Math.min(4, remain);
        remain -= step;
        b.x += d.x * step;
        b.y += d.y * step;
        if (resolveBullet(b)) break;
      }
    }

    // 子弹对撞
    for (let i = 0; i < bullets.length; i++) {
      const a = bullets[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < bullets.length; j++) {
        const c = bullets[j];
        if (!c.alive || a.fromPlayer === c.fromPlayer) continue;
        if (rectsOverlap(a.x, a.y, BULLET, BULLET, c.x, c.y, BULLET, BULLET)) {
          a.alive = false;
          c.alive = false;
          spark(a.x + 3, a.y + 3, 5);
          break;
        }
      }
    }

    bullets = bullets.filter((b) => b.alive);
  }

  function resolveBullet(b) {
    const bx = b.x;
    const by = b.y;
    if (bx < 0 || by < 0 || bx + BULLET > W || by + BULLET > H) {
      b.alive = false;
      spark(clamp(bx + 3, 0, W - 1), clamp(by + 3, 0, H - 1), 4);
      return true;
    }

    const c0 = Math.floor(bx / CELL);
    const c1 = Math.floor((bx + BULLET - 0.01) / CELL);
    const r0 = Math.floor(by / CELL);
    const r1 = Math.floor((by + BULLET - 0.01) / CELL);

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = gridAt(c, r);
        if (v === T.BASE) {
          b.alive = false;
          destroyBase();
          return true;
        }
        if (v === T.BRICK) {
          b.alive = false;
          hitCells(b, T.BRICK);
          return true;
        }
        if (v === T.STEEL) {
          b.alive = false;
          if (b.power >= 2) hitCells(b, T.STEEL);
          else {
            if (window.SFX) SFX.steel();
            spark(bx + 3, by + 3, 4);
          }
          return true;
        }
      }
    }

    for (let i = 0; i < tanks.length; i++) {
      const t = tanks[i];
      if (!t.alive || t === b.owner) continue;
      if (t.isPlayer === b.fromPlayer) continue;
      if (!rectsOverlap(bx, by, BULLET, BULLET, t.x, t.y, TANK, TANK)) continue;
      b.alive = false;
      hitTank(t, b);
      return true;
    }
    return false;
  }

  function hitCells(b, type) {
    const horiz = b.dir === 'left' || b.dir === 'right';
    let c0, c1, r0, r1;
    if (horiz) {
      const cy = b.y + BULLET / 2;
      r0 = Math.floor((cy - TANK / 2) / CELL);
      r1 = Math.floor((cy + TANK / 2 - 0.01) / CELL);
      c0 = Math.floor(b.x / CELL);
      c1 = Math.floor((b.x + BULLET - 0.01) / CELL);
    } else {
      const cx = b.x + BULLET / 2;
      c0 = Math.floor((cx - TANK / 2) / CELL);
      c1 = Math.floor((cx + TANK / 2 - 0.01) / CELL);
      r0 = Math.floor(b.y / CELL);
      r1 = Math.floor((b.y + BULLET - 0.01) / CELL);
    }

    let any = false;
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
        const i = cellIndex(c, r);
        if (grid[i] === type) {
          grid[i] = T.EMPTY;
          any = true;
        }
      }
    }
    if (any) {
      rebuildWalls();
      explode(b.x + 3, b.y + 3, false, 0.5);
      if (window.SFX) {
        if (type === T.BRICK) SFX.brick();
        else SFX.steel();
      }
    }
  }

  function hitTank(t, b) {
    if (t.shield > 0) {
      spark(b.x + 3, b.y + 3, 5);
      return;
    }
    if (t.isPlayer) {
      killPlayer();
      return;
    }
    t.hp -= 1;
    t.flash = 0.12;
    if (t.hp <= 0) {
      killEnemy(t);
    } else {
      if (window.SFX) SFX.steel();
      spark(b.x + 3, b.y + 3, 5);
    }
  }

  /* ---------------- 基地 ---------------- */
  function destroyBase() {
    if (!baseAlive) return;
    baseAlive = false;
    for (let r = BASE_R; r < BASE_R + 2; r++) {
      for (let c = BASE_C; c < BASE_C + 2; c++) {
        grid[cellIndex(c, r)] = T.EMPTY;
      }
    }
    rebuildWalls();
    explode(BASE_C * CELL + 16, BASE_R * CELL + 16, true, 2.4);
    if (window.SFX) SFX.explode(true);
    gameOver('老鹰基地被摧毁');
  }

  function baseRing() {
    const out = [];
    for (let r = BASE_R - 2; r <= BASE_R + 1; r++) {
      for (let c = BASE_C - 1; c <= BASE_C + 2; c++) {
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
        const isBase = r >= BASE_R && r < BASE_R + 2 && c >= BASE_C && c < BASE_C + 2;
        if (!isBase) out.push([c, r]);
      }
    }
    return out;
  }

  function applyShovel() {
    restoreShovel();
    const ring = baseRing();
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i][0];
      const r = ring[i][1];
      const idx = cellIndex(c, r);
      shovelCells.push([idx, grid[idx]]);
      grid[idx] = T.STEEL;
    }
    shovelT = 16;
    rebuildWalls();
  }

  function restoreShovel() {
    for (let i = 0; i < shovelCells.length; i++) {
      grid[shovelCells[i][0]] = shovelCells[i][1];
    }
    shovelCells = [];
    rebuildWalls();
  }

  /* ---------------- 道具 ---------------- */
  const ITEM_TYPES = [
    { type: 'star', w: 26 },
    { type: 'helmet', w: 18 },
    { type: 'grenade', w: 13 },
    { type: 'clock', w: 13 },
    { type: 'shovel', w: 15 },
    { type: 'tank', w: 15 }
  ];

  function randomItemType() {
    let total = 0;
    for (let i = 0; i < ITEM_TYPES.length; i++) total += ITEM_TYPES[i].w;
    let r = Math.random() * total;
    for (let i = 0; i < ITEM_TYPES.length; i++) {
      r -= ITEM_TYPES[i].w;
      if (r <= 0) return ITEM_TYPES[i].type;
    }
    return 'star';
  }

  function dropItem() {
    const spots = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (grid[cellIndex(c, r)] === T.EMPTY) spots.push([c, r]);
      }
    }
    if (!spots.length) return;
    const s = spots[(Math.random() * spots.length) | 0];
    items.push({ x: s[0] * CELL, y: s[1] * CELL, type: randomItemType(), life: 15, phase: 0 });
  }

  function updateItems(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      it.phase += dt;
      if (it.life <= 0) {
        items.splice(i, 1);
        continue;
      }
      if (player && player.alive && rectsOverlap(it.x, it.y, TANK, TANK, player.x, player.y, TANK, TANK)) {
        applyItem(it.type);
        items.splice(i, 1);
      }
    }
  }

  function applyItem(type) {
    if (window.SFX) SFX.power();
    addScore(50);
    if (type === 'star') {
      if (player) {
        player.star = Math.min(3, player.star + 1);
        applyStarLevel(player);
      }
    } else if (type === 'helmet') {
      if (player) player.shield = Math.max(player.shield, 9);
    } else if (type === 'grenade') {
      for (let i = 0; i < tanks.length; i++) {
        const t = tanks[i];
        if (t.alive && !t.isPlayer) killEnemy(t);
      }
    } else if (type === 'clock') {
      for (let i = 0; i < tanks.length; i++) {
        const t = tanks[i];
        if (t.alive && !t.isPlayer) t.frozenT = 7;
      }
    } else if (type === 'shovel') {
      applyShovel();
    } else if (type === 'tank') {
      game.lives += 1;
      updateHud();
      if (window.SFX) SFX.life();
    }
  }

  /* ---------------- 特效 ---------------- */
  function explode(x, y, big, scale) {
    const n = big ? 14 : 7;
    const sp = (big ? 105 : 55) * (scale || 1);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * (0.35 + Math.random() * 0.9);
      particles.push({
        kind: 'dot',
        x: x,
        y: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: (big ? 3.5 : 2.5) * (0.6 + Math.random()),
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color: Math.random() < 0.45 ? '#ffe08a' : Math.random() < 0.7 ? '#ff8a3c' : '#fff2c9'
      });
    }
    particles.push({
      kind: 'ring',
      x: x,
      y: y,
      r: 4,
      rmax: (big ? 44 : 26) * (scale || 1),
      life: 0.3,
      max: 0.3,
      color: '#ffd98a'
    });
  }

  function spark(x, y, n) {
    for (let i = 0; i < (n || 4); i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        kind: 'dot',
        x: x,
        y: y,
        vx: Math.cos(a) * 70,
        vy: Math.sin(a) * 70,
        r: 1.6,
        life: 0.14,
        max: 0.14,
        color: '#fff0b8'
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      if (p.kind === 'dot') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else {
        p.r += (p.rmax - p.r) * Math.min(1, dt * 12);
      }
    }
  }

  /* ---------------- 分数 / HUD ---------------- */
  function addScore(n) {
    game.score += n;
    updateHud();
  }

  let hudCache = {};
  function updateHud() {
    const stageTxt = 'STAGE ' + game.stage;
    if (hudCache.stage !== stageTxt) {
      hudStage.textContent = stageTxt;
      hudCache.stage = stageTxt;
    }
    const livesTxt = '♜ ×' + Math.max(0, game.lives);
    if (hudCache.lives !== livesTxt) {
      hudLives.textContent = livesTxt;
      hudCache.lives = livesTxt;
    }
    let alive = 0;
    for (let i = 0; i < tanks.length; i++) {
      if (tanks[i].alive && !tanks[i].isPlayer) alive++;
    }
    const left = Math.max(0, toSpawn) + alive;
    const leftTxt = '敌 ' + left;
    if (hudCache.left !== leftTxt) {
      hudEnemies.textContent = leftTxt;
      hudEnemies.classList.toggle('warn', left <= 3);
      hudCache.left = leftTxt;
    }
    const scoreTxt = String(game.score).padStart(6, '0');
    if (hudCache.score !== scoreTxt) {
      hudScore.textContent = scoreTxt;
      hudCache.score = scoreTxt;
    }
  }

  /* ---------------- 覆盖层 ---------------- */
  function showOverlay(html) {
    overlayInner.innerHTML = html;
    overlay.classList.add('show');
  }

  function hideOverlay() {
    overlay.classList.remove('show');
  }

  function showTitle() {
    game.state = 'title';
    player = null;
    updateHud();
    showOverlay(
      '<h1 class="card-title">坦克大战</h1>' +
        '<p class="card-sub">B A T T L E &nbsp; C I T Y</p>' +
        '<p class="card-body">' +
        '守住底部的<b>老鹰基地</b>，歼灭全部敌方坦克。<br>' +
        '左半屏拖动<b>摇杆</b>移动 · 右半屏或<b>开火键</b>射击<br>' +
        '★升级弹药 &nbsp; ♥临时护盾 &nbsp; ✹全屏轰炸<br>' +
        '⏱冻结敌人 &nbsp; ⛏基地铁壁 &nbsp; ♜额外生命' +
        '</p>' +
        '<p class="card-foot">点击屏幕开始</p>'
    );
  }

  function showPauseOverlay() {
    showOverlay(
      '<h1 class="card-title">已暂停</h1>' +
        '<p class="card-sub">STAGE ' + game.stage + '</p>' +
        '<p class="card-body">分数 <b>' + game.score + '</b> &nbsp;|&nbsp; 剩余生命 <b>' + game.lives + '</b></p>' +
        '<p class="card-foot">点击屏幕继续</p>'
    );
  }

  function stageClear() {
    game.state = 'clear';
    if (window.SFX) SFX.stageClear();
    showOverlay(
      '<h1 class="card-title">STAGE ' + game.stage + ' 通过</h1>' +
        '<div class="stat-row"><div class="stat"><i>SCORE</i><b>' + game.score + '</b></div>' +
        '<div class="stat"><i>LIVES</i><b>' + game.lives + '</b></div></div>' +
        '<p class="card-foot">点击进入下一关</p>'
    );
  }

  function gameOver(reason) {
    if (game.state === 'over') return;
    game.state = 'over';
    if (window.SFX) SFX.gameOver();
    showOverlay(
      '<h1 class="card-title danger">GAME OVER</h1>' +
        '<p class="card-sub">' + (reason || '') + '</p>' +
        '<div class="stat-row"><div class="stat"><i>关卡</i><b>' + game.stage + '</b></div>' +
        '<div class="stat"><i>得分</i><b>' + game.score + '</b></div></div>' +
        '<p class="card-foot">点击屏幕重新开始</p>'
    );
  }

  function startGame() {
    game.stage = 1;
    game.score = 0;
    game.lives = 3;
    hudCache = {};
    loadStage();
  }

  function nextStage() {
    game.stage += 1;
    loadStage();
  }

  function togglePause() {
    if (game.state === 'playing') {
      game.state = 'paused';
      showPauseOverlay();
    } else if (game.state === 'paused') {
      game.state = 'playing';
      hideOverlay();
    }
  }

  function handleOverlayTap() {
    if (game.state === 'title') startGame();
    else if (game.state === 'clear') nextStage();
    else if (game.state === 'over') showTitle();
    else if (game.state === 'paused') togglePause();
  }

  /* ---------------- 主循环逻辑 ---------------- */
  function update(dt) {
    time += dt;
    updateParticles(dt);

    if (game.state !== 'playing') return;

    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }

    if (shovelT > 0) {
      shovelT -= dt;
      if (shovelT <= 0) restoreShovel();
    }

    updatePlayer(dt);

    for (let i = 0; i < tanks.length; i++) {
      if (tanks[i].alive && !tanks[i].isPlayer) updateEnemy(tanks[i], dt);
    }

    updateBullets(dt);

    const before = tanks.length;
    tanks = tanks.filter((t) => t.alive);
    if (tanks.length !== before) updateHud();

    updateItems(dt);
    updateSpawn(dt);

    if (!player && game.lives > 0 && respawnT > 0) {
      respawnT -= dt;
      if (respawnT <= 0) spawnPlayer(3);
    }

    // 通关判定
    if (toSpawn <= 0 && game.state === 'playing') {
      let alive = 0;
      for (let i = 0; i < tanks.length; i++) {
        if (tanks[i].alive && !tanks[i].isPlayer) alive++;
      }
      if (alive === 0) {
        stageClearT += dt;
        if (stageClearT > 1.1) stageClear();
      }
    }
  }

  /* ---------------- 绘制 ---------------- */
  function drawBrick(c2d, c, r) {
    const x = c * CELL;
    const y = r * CELL;
    c2d.fillStyle = '#b8522e';
    c2d.fillRect(x, y, CELL, CELL);
    c2d.fillStyle = '#6f2a18';
    c2d.fillRect(x, y + 3, CELL, 1);
    c2d.fillRect(x, y + 7, CELL, 1);
    c2d.fillRect(x, y + 11, CELL, 1);
    c2d.fillRect(x, y + 15, CELL, 1);
    c2d.fillRect(x + 7, y, 1, 3);
    c2d.fillRect(x + 3, y + 4, 1, 3);
    c2d.fillRect(x + 11, y + 4, 1, 3);
    c2d.fillRect(x + 7, y + 8, 1, 3);
    c2d.fillRect(x + 3, y + 12, 1, 3);
    c2d.fillRect(x + 11, y + 12, 1, 3);
    c2d.fillStyle = 'rgba(255,220,190,0.18)';
    c2d.fillRect(x, y, CELL, 1);
  }

  function drawSteel(c2d, c, r) {
    const x = c * CELL;
    const y = r * CELL;
    c2d.fillStyle = '#8e99a5';
    c2d.fillRect(x, y, CELL, CELL);
    c2d.fillStyle = '#cfd8e2';
    c2d.fillRect(x + 1, y + 1, CELL - 2, 3);
    c2d.fillRect(x + 1, y + 1, 3, CELL - 2);
    c2d.fillStyle = '#5c6670';
    c2d.fillRect(x + 1, y + CELL - 4, CELL - 2, 3);
    c2d.fillRect(x + CELL - 4, y + 1, 3, CELL - 2);
    c2d.fillStyle = '#b3bec9';
    c2d.fillRect(x + 5, y + 5, CELL - 10, CELL - 10);
  }

  function drawGrassTile(c2d, c, r) {
    const x = c * CELL;
    const y = r * CELL;
    c2d.fillStyle = '#1d4423';
    c2d.fillRect(x, y, CELL, CELL);
    c2d.fillStyle = '#2c6b33';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2 === 0) c2d.fillRect(x + i * 4, y + j * 4, 3, 3);
      }
    }
    c2d.fillStyle = 'rgba(140,220,140,0.22)';
    c2d.fillRect(x + 2, y + 2, 2, 2);
    c2d.fillRect(x + 9, y + 6, 2, 2);
  }

  function drawBackground() {
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(60,90,120,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= COLS; i += 2) {
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, H);
    }
    for (let j = 0; j <= ROWS; j += 2) {
      ctx.moveTo(0, j * CELL + 0.5);
      ctx.lineTo(W, j * CELL + 0.5);
    }
    ctx.stroke();
  }

  function drawWaterLayer() {
    for (let i = 0; i < waterCells.length; i++) {
      const c = waterCells[i][0];
      const r = waterCells[i][1];
      const x = c * CELL;
      const y = r * CELL;
      ctx.fillStyle = '#12365c';
      ctx.fillRect(x, y, CELL, CELL);
      const ph = Math.sin(time * 2.4 + c * 0.7 + r * 0.45);
      ctx.fillStyle = 'rgba(90,170,235,0.55)';
      ctx.fillRect(x, y + 4 + ph * 2.5, CELL, 2);
      ctx.fillStyle = 'rgba(40,110,175,0.7)';
      ctx.fillRect(x, y + 10 - ph * 2.5, CELL, 2);
      ctx.fillStyle = 'rgba(150,215,255,0.25)';
      ctx.fillRect(x + 2 + ph * 2, y + 7, 5, 1.5);
    }
  }

  function drawBaseTile() {
    const bx = BASE_C * CELL;
    const by = BASE_R * CELL;
    ctx.save();
    ctx.translate(bx + 16, by + 16);
    if (baseAlive) {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = '#c9a24a';
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(0, -3);
      ctx.lineTo(14, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f0d98b';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(7, -3);
      ctx.lineTo(0, 6);
      ctx.lineTo(-7, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a6a24';
      ctx.fillRect(-13, 11, 26, 4);
      ctx.fillStyle = '#ffeaa7';
      ctx.fillRect(-2, -8, 4, 6);
    } else {
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = '#4a4038';
      ctx.beginPath();
      ctx.moveTo(-14, 12);
      ctx.lineTo(-4, -4);
      ctx.lineTo(2, 6);
      ctx.lineTo(8, -8);
      ctx.lineTo(14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7a3a22';
      ctx.fillRect(-12, 6, 8, 5);
      ctx.fillRect(3, 2, 7, 6);
    }
    ctx.restore();
  }

  function drawTankShape(t) {
    const cx = t.x + TANK / 2;
    const cy = t.y + TANK / 2;

    let body, dark, light;
    if (t.isPlayer) {
      body = '#e8c33a';
      dark = '#a8801c';
      light = '#ffeea8';
      if (t.star >= 2) {
        body = '#ffd94d';
        dark = '#b8912a';
        light = '#fff6c9';
      }
      if (t.star >= 3) {
        body = '#ffe27a';
        dark = '#c9a227';
        light = '#ffffff';
      }
    } else {
      const c = ENEMY_TYPES[t.type];
      body = c.color;
      dark = c.dark;
      light = c.light;
      if (t.type === 'armor') {
        const ratio = t.hp / t.maxHp;
        if (ratio < 0.34) {
          body = '#e06a4a';
          dark = '#8f3520';
          light = '#ffb59a';
        } else if (ratio < 0.67) {
          body = '#d9a04a';
          dark = '#8f6520';
          light = '#f6d79a';
        }
      }
    }
    if (t.flash > 0) {
      body = '#ffffff';
      dark = '#cfd8e2';
      light = '#ffffff';
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(DIRS[t.dir].ang);

    // 履带
    ctx.fillStyle = '#1a1e23';
    ctx.fillRect(-16, -16, 32, 32);
    ctx.fillStyle = dark;
    ctx.fillRect(-15, -15, 6, 30);
    ctx.fillRect(9, -15, 6, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = -13; i < 15; i += 6) {
      ctx.fillRect(-15, i, 6, 2.5);
      ctx.fillRect(9, i, 6, 2.5);
    }

    // 车体
    ctx.fillStyle = body;
    ctx.fillRect(-8, -13, 16, 27);
    ctx.fillStyle = light;
    ctx.fillRect(-8, -13, 16, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-8, 9, 16, 5);

    // 炮塔底座
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 1, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(0, 1, 5.2, 0, Math.PI * 2);
    ctx.fill();

    // 炮管
    ctx.fillStyle = body;
    ctx.fillRect(-2.5, -18, 5, 18);
    ctx.fillStyle = light;
    ctx.fillRect(-2.5, -18, 1.8, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(1.4, -18, 1.1, 18);

    // 外轮廓
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-16.5, -16.5, 33, 33);

    ctx.restore();

    if (t.shield > 0) {
      const a = 0.28 + 0.32 * Math.abs(Math.sin(time * 12));
      ctx.strokeStyle = t.isPlayer ? 'rgba(120,220,255,' + a.toFixed(3) + ')' : 'rgba(255,190,120,' + (a * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 19, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 携带道具的敌人：闪烁标记
    if (!t.isPlayer && t.carriesItem) {
      const on = Math.sin(time * 10) > 0;
      if (on) {
        ctx.fillStyle = 'rgba(255,90,90,0.85)';
        ctx.fillRect(cx - 4, cy - 28, 8, 4);
      }
    }
  }

  function drawBullet(b) {
    const cx = b.x + BULLET / 2;
    const cy = b.y + BULLET / 2;
    ctx.save();
    ctx.shadowColor = b.fromPlayer ? 'rgba(255,225,120,0.9)' : 'rgba(255,120,80,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = b.fromPlayer ? '#fff3b0' : '#ff9c66';
    ctx.beginPath();
    ctx.arc(cx, cy, BULLET / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = b.fromPlayer ? '#ffffff' : '#ffd9c4';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  function drawItem(it) {
    if (it.life < 3 && Math.sin(it.life * 16) < 0) return;
    const x = it.x;
    const y = it.y;
    const pulse = 1 + Math.sin(it.phase * 5) * 0.06;
    ctx.save();
    ctx.translate(x + 16, y + 16);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeStyle = 'rgba(255,215,94,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-14, -14, 28, 28);

    const map = { star: '#ffd75e', helmet: '#7fd3ff', grenade: '#ff8a5c', clock: '#b9a2ff', shovel: '#c9d4e0', tank: '#8ff0a4' };
    ctx.fillStyle = map[it.type] || '#ffd75e';
    ctx.font = 'bold 18px "Segoe UI Symbol", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { star: '★', helmet: '♥', grenade: '✹', clock: '⏱', shovel: '⛏', tank: '♜' };
    ctx.fillText(glyph[it.type] || '?', 0, 1);
    ctx.restore();
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const k = p.life / p.max;
      if (p.kind === 'ring') {
        ctx.strokeStyle = 'rgba(255,217,138,' + (k * 0.85).toFixed(3) + ')';
        ctx.lineWidth = 2.5 * k + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBanner() {
    if (!banner) return;
    const k = Math.min(1, banner.t / 0.35);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H / 2 - 42, W, 84);
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 34px ui-monospace, Consolas, monospace';
    ctx.fillText(banner.text, W / 2, H / 2 - 6);
    if (banner.sub) {
      ctx.fillStyle = '#9fb3c8';
      ctx.font = 'bold 14px ui-monospace, Consolas, monospace';
      ctx.fillText(banner.sub, W / 2, H / 2 + 22);
    }
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawWaterLayer();
    ctx.drawImage(wallCanvas, 0, 0);
    drawBaseTile();
    for (let i = 0; i < items.length; i++) drawItem(items[i]);
    for (let i = 0; i < tanks.length; i++) {
      if (tanks[i].alive) drawTankShape(tanks[i]);
    }
    for (let i = 0; i < bullets.length; i++) drawBullet(bullets[i]);
    if (grassCanvas) ctx.drawImage(grassCanvas, 0, 0);
    drawParticles();
    drawBanner();
  }

  /* ---------------- 输入 ---------------- */
  const input = { dir: null, firing: false };
  const keys = new Set();
  let movePointer = null;
  let firePointer = null;
  let stickBase = { x: 0, y: 0 };
  const STICK_R = 52;
  const DEAD = 9;

  function getInputDir() {
    if (input.dir) return input.dir;
    if (keys.has('arrowup') || keys.has('w')) return 'up';
    if (keys.has('arrowdown') || keys.has('s')) return 'down';
    if (keys.has('arrowleft') || keys.has('a')) return 'left';
    if (keys.has('arrowright') || keys.has('d')) return 'right';
    return null;
  }

  function isFiring() {
    return input.firing || keys.has(' ') || keys.has('j') || keys.has('k');
  }

  function placeStick(x, y) {
    stickBase.x = x;
    stickBase.y = y;
    stickEl.style.left = x + 'px';
    stickEl.style.top = y + 'px';
    stickEl.classList.add('active');
    knobEl.style.transform = 'translate(-50%, -50%)';
  }

  function moveKnob(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / STICK_R) * (STICK_R * 0.72);
    knobEl.style.transform =
      'translate(calc(-50% + ' + ((dx / len) * k).toFixed(1) + 'px), calc(-50% + ' + ((dy / len) * k).toFixed(1) + 'px))';
  }

  function resetStick() {
    movePointer = null;
    input.dir = null;
    stickEl.classList.remove('active');
    knobEl.style.transform = 'translate(-50%, -50%)';
  }

  const app = document.getElementById('app');

  app.addEventListener(
    'pointerdown',
    (e) => {
      if (window.SFX) SFX.unlock();

      if (e.target === fireBtn) return;
      if (e.target === pauseBtn) return;
      if (e.target && e.target.closest && e.target.closest('#overlay')) return;
      if (game.state !== 'playing') return;

      if (e.clientX < window.innerWidth * 0.5 && movePointer === null) {
        movePointer = e.pointerId;
        placeStick(e.clientX, e.clientY);
        e.preventDefault();
      } else if (firePointer === null && movePointer !== e.pointerId) {
        firePointer = e.pointerId;
        input.firing = true;
        e.preventDefault();
      }
    },
    { passive: false }
  );

  app.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerId !== movePointer) return;
      const dx = e.clientX - stickBase.x;
      const dy = e.clientY - stickBase.y;
      if (Math.hypot(dx, dy) < DEAD) {
        input.dir = null;
        knobEl.style.transform = 'translate(-50%, -50%)';
      } else {
        input.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        moveKnob(dx, dy);
      }
      e.preventDefault();
    },
    { passive: false }
  );

  function endPointer(e) {
    if (e.pointerId === movePointer) resetStick();
    if (e.pointerId === firePointer) {
      firePointer = null;
      input.firing = false;
    }
  }
  app.addEventListener('pointerup', endPointer);
  app.addEventListener('pointercancel', endPointer);
  app.addEventListener('pointerleave', endPointer);
  window.addEventListener('blur', () => {
    resetStick();
    input.firing = false;
    firePointer = null;
  });

  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (window.SFX) SFX.unlock();
    input.firing = true;
    fireBtn.classList.add('pressed');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
    fireBtn.addEventListener(ev, () => {
      input.firing = false;
      fireBtn.classList.remove('pressed');
    });
  });

  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (game.state === 'playing' || game.state === 'paused') togglePause();
  });

  overlay.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      if (window.SFX) SFX.unlock();
      handleOverlayTap();
    },
    { passive: false }
  );

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    keys.add(k);
    if (k === 'p' || k === 'escape') togglePause();
    if ((k === 'enter' || k === ' ') && game.state !== 'playing') handleOverlayTap();
  });
  document.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') togglePause();
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- 循环 ---------------- */
  let lastTs = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    update(dt);
    render();
  }

  /* ---------------- 启动 ---------------- */
  resize();
  // 先铺一张静态标题背景，避免开局黑屏
  grid = new Uint8Array(COLS * ROWS);
  buildCaches();
  updateHud();
  showTitle();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && !window.Capacitor && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
