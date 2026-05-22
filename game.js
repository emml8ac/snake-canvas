'use strict';

/* ===================================================================
   SNAKE — Canvas Edition
   Vanilla HTML/CSS/JS. Zero dependencies. No build step.
   =================================================================== */

/* === CONFIGURATION === */

const GRID_SIZE = 20;
const CELL_SIZE = 25;
const CANVAS_SIZE = 500;
const BASE_SPEED = 150;
const MIN_SPEED = 60;
const SPEED_DECREASE_PER_LEVEL = 5;
const SCORE_PER_LEVEL = 50;
const MAX_DIRECTION_QUEUE = 2;

const COLORS = {
  background: '#1a1a2e',
  snake:      '#00ff88',
  snakeHead:  '#00cc66',
  food:       '#ff4757',
  grid:       '#16213e'
};

const DIRECTIONS = {
  UP:    { x:  0, y: -1 },
  DOWN:  { x:  0, y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 }
};

/* === DOM REFERENCES === */

let canvas, ctx, scoreDisplay;

/* === STORAGE KEYS === */

const STORAGE_KEY = 'snake-canvas-highscore';

/* === GAME STATE === */

function createInitialState () {
  return {
    snake: [
      { x: 10, y: 10 },
      { x:  9, y: 10 },
      { x:  8, y: 10 }
    ],
    food:            null,
    direction:       DIRECTIONS.RIGHT,
    directionQueue:  [],
    score:           0,
    highScore:       0,
    state:           'idle',       // 'idle' | 'playing' | 'gameOver'
    tickInterval:    BASE_SPEED,
    accumulator:     0,
    gridSize:        GRID_SIZE,
    cellSize:        CELL_SIZE,
    lastTimestamp:   0
  };
}

function resetState () {
  const fresh = createInitialState();
  fresh.highScore = state ? state.highScore : 0;
  fresh.food = spawnFoodPosition(fresh);
  return fresh;
}

/* === FOOD === */

function spawnFoodPosition (state) {
  const occupied = new Set(state.snake.map(c => `${c.x},${c.y}`));
  const emptyCells = [];

  for (let x = 0; x < state.gridSize; x++) {
    for (let y = 0; y < state.gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) return null; // board full (win condition)
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function spawnFood (state) {
  const pos = spawnFoodPosition(state);
  if (!pos) {
    // Snake fills the grid — player wins! Treat as game win.
    return { ...state, food: null };
  }
  return { ...state, food: pos };
}

/* === DIRECTION HANDLING === */

function isOppositeDirection (current, next) {
  return current.x + next.x === 0 && current.y + next.y === 0;
}

function handleKeyDown (event, state) {
  const keyMap = {
    'ArrowUp':    DIRECTIONS.UP,
    'ArrowDown':  DIRECTIONS.DOWN,
    'ArrowLeft':  DIRECTIONS.LEFT,
    'ArrowRight': DIRECTIONS.RIGHT
  };

  const dir = keyMap[event.key];
  if (!dir) return false;

  event.preventDefault();

  // Start game from idle
  if (state.state === 'idle') {
    state.direction = dir;
    state.directionQueue = [];
    state.state = 'playing';
    return true;
  }

  // Ignore input if not playing
  if (state.state !== 'playing') return true;

  // Determine the last direction in queue (or current direction if queue empty)
  const lastDir = state.directionQueue.length > 0
    ? state.directionQueue[state.directionQueue.length - 1]
    : state.direction;

  // Reject 180-degree reversal
  if (isOppositeDirection(lastDir, dir)) return true;

  // Push to queue (max depth)
  if (state.directionQueue.length < MAX_DIRECTION_QUEUE) {
    state.directionQueue.push(dir);
  }

  return true;
}

function dequeueDirection (state) {
  if (state.directionQueue.length > 0) {
    state.direction = state.directionQueue.shift();
  }
}

/* === MOVEMENT & COLLISION === */

function moveSnake (state) {
  const head = state.snake[0];
  const newHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y
  };

  const newBody = [newHead, ...state.snake];

  // If growing, don't pop tail
  if (state.growing) {
    return { ...state, snake: newBody, growing: false };
  }

  newBody.pop();
  return { ...state, snake: newBody };
}

function checkCollision (state) {
  const head = state.snake[0];

  // Wall collision
  if (head.x < 0 || head.x >= state.gridSize ||
      head.y < 0 || head.y >= state.gridSize) {
    return 'wall';
  }

  // Self collision (check head against rest of body)
  for (let i = 1; i < state.snake.length; i++) {
    if (state.snake[i].x === head.x && state.snake[i].y === head.y) {
      return 'self';
    }
  }

  return 'none';
}

/* === SPEED SCALING === */

function calculateSpeed (score) {
  const reduction = Math.floor(score / SCORE_PER_LEVEL) * SPEED_DECREASE_PER_LEVEL;
  return Math.max(MIN_SPEED, BASE_SPEED - reduction);
}

/* === GAME TICK === */

function tick (state) {
  let next = { ...state };
  next.growing = false;

  // Dequeue next direction
  dequeueDirection(next);

  // Move snake
  next = moveSnake(next);

  // Check collisions
  const collision = checkCollision(next);
  if (collision !== 'none') {
    next.state = 'gameOver';
    // Save high score if beaten
    if (next.score > next.highScore) {
      next.highScore = next.score;
      saveHighScore(next.score);
    }
    updateScoreDisplay(next);
    return next;
  }

  // Check food consumption
  if (next.food &&
      next.snake[0].x === next.food.x &&
      next.snake[0].y === next.food.y) {
    next.growing = true;
    next.score += 10;
    next.tickInterval = calculateSpeed(next.score);
    next = spawnFood(next);
    updateScoreDisplay(next);
  }

  return next;
}

/* === CANVAS RENDERING === */

function drawGrid (ctx, state) {
  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Grid lines
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;

  for (let i = 0; i <= state.gridSize; i++) {
    const pos = i * state.cellSize;

    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, CANVAS_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(CANVAS_SIZE, pos);
    ctx.stroke();
  }
}

function drawSnake (ctx, state) {
  state.snake.forEach((segment, index) => {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? COLORS.snakeHead : COLORS.snake;

    // 1px gap between segments
    const gap = 1;
    ctx.fillRect(
      segment.x * state.cellSize + gap,
      segment.y * state.cellSize + gap,
      state.cellSize - gap * 2,
      state.cellSize - gap * 2
    );
  });
}

function drawFood (ctx, state) {
  if (!state.food) return;

  ctx.fillStyle = COLORS.food;
  const padding = 2;
  ctx.fillRect(
    state.food.x * state.cellSize + padding,
    state.food.y * state.cellSize + padding,
    state.cellSize - padding * 2,
    state.cellSize - padding * 2
  );
}

function drawOverlay (ctx, title, subtitle) {
  // Semi-transparent background
  ctx.fillStyle = 'rgba(26, 26, 46, 0.85)';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Title
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 24);

  // Subtitle
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '18px monospace';
  ctx.fillText(subtitle, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 32);
}

function drawIdleScreen (ctx, state) {
  drawOverlay(ctx, 'SNAKE', 'Press Arrow Keys to Start');
}

function drawPausedScreen (ctx, state) {
  drawOverlay(ctx, 'PAUSED', 'Press Space or click to resume');
}

function drawGameOverScreen (ctx, state) {
  // Overlay background
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Game Over title
  ctx.fillStyle = '#ff4757';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 40);

  // Final score
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '22px monospace';
  ctx.fillText(`Score: ${state.score}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);

  // Best score
  ctx.fillStyle = '#00ff88';
  ctx.font = '18px monospace';
  ctx.fillText(`Best: ${state.highScore}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 45);

  // Restart prompt
  ctx.fillStyle = '#888';
  ctx.font = '16px monospace';
  ctx.fillText('Press Space or click to restart', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 85);
}

function render (ctx, state) {
  drawGrid(ctx, state);
  drawFood(ctx, state);
  drawSnake(ctx, state);

  if (state.state === 'idle') {
    drawIdleScreen(ctx, state);
  } else if (state.state === 'gameOver') {
    drawGameOverScreen(ctx, state);
  } else if (state.state === 'playing' && loopPaused) {
    drawPausedScreen(ctx, state);
  }
}

/* === SCORE & PERSISTENCE === */

function updateScoreDisplay (state) {
  if (!scoreDisplay) return;
  scoreDisplay.textContent = `Score: ${state.score} | High: ${state.highScore}`;
}

function loadHighScore () {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch (_e) {
    return 0;
  }
}

function saveHighScore (score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch (_e) {
    // localStorage unavailable — silently ignore
  }
}

/* === GAME LOOP === */

let animFrameId = null;
let loopPaused = false;
let state = null;

function gameLoop (timestamp) {
  if (loopPaused) return;

  // First frame — initialize timestamp
  if (state.lastTimestamp === 0) {
    state.lastTimestamp = timestamp;
  }

  const delta = timestamp - state.lastTimestamp;
  state.lastTimestamp = timestamp;

  // Cap delta to prevent spiral of death (e.g. tab was backgrounded)
  if (delta > 1000) {
    animFrameId = requestAnimationFrame(gameLoop);
    render(ctx, state);
    return;
  }

  // Fixed timestep accumulator
  state.accumulator += delta;

  while (state.accumulator >= state.tickInterval) {
    tick(state);
    state.accumulator -= state.tickInterval;

    // Stop ticking if game over
    if (state.state === 'gameOver' || state.state === 'idle') {
      state.accumulator = 0;
      break;
    }
  }

  render(ctx, state);

  // Continue loop if still playing
  if (state.state === 'playing') {
    animFrameId = requestAnimationFrame(gameLoop);
  }
}

function startGame () {
  state = resetState();
  state.highScore = loadHighScore();
  state.food = spawnFoodPosition(state);
  state.state = 'idle';
  state.lastTimestamp = 0;
  state.accumulator = 0;
  updateScoreDisplay(state);
  render(ctx, state);
}

function pauseGame () {
  if (state.state === 'playing') {
    loopPaused = true;
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    render(ctx, state);
  }
}

function resumeGame () {
  if (loopPaused && state.state === 'playing') {
    loopPaused = false;
    state.lastTimestamp = 0;  // reset to avoid huge delta
    animFrameId = requestAnimationFrame(gameLoop);
  }
}

function togglePause () {
  if (state.state === 'playing') {
    if (loopPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  }
}

/* === TAB VISIBILITY === */

document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    pauseGame();
  } else {
    resumeGame();
  }
});

/* === TOUCH CONTROLS === */

let touchStartX = 0;
let touchStartY = 0;

// Touch listeners are registered in DOMContentLoaded when canvas is available.
// The touch handlers live inside the init block below.

/* === KEYBOARD CONTROLS === */

document.addEventListener('keydown', function (event) {
  // Handle space for restart / pause
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();

    if (state.state === 'gameOver') {
      // Restart
      startGame();
      state.lastTimestamp = 0;
      animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    if (state.state === 'playing') {
      togglePause();
      return;
    }

    // idle — space does nothing special
    return;
  }

  // Handle arrow keys
  const handled = handleKeyDown(event, state);

  // Start game loop if we just transitioned to playing
  if (handled && state.state === 'playing' && animFrameId === null) {
    state.lastTimestamp = 0;
    animFrameId = requestAnimationFrame(gameLoop);
  }
});

/* === CANVAS RESIZE HANDLER === */

function resizeCanvas () {
  if (!canvas) return;
  // The CSS handles max-width/max-height, but we ensure the
  // canvas attributes stay at 500×500 for crisp rendering
  // (the CSS will scale it down responsively)
}

window.addEventListener('resize', resizeCanvas);

/* === INIT === */

document.addEventListener('DOMContentLoaded', function () {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  scoreDisplay = document.getElementById('scoreDisplay');

  if (!canvas || !ctx) {
    document.body.innerHTML = '<p style="color:#ff4757;padding:2rem;text-align:center;">' +
      'Canvas not supported. Please use a modern browser.</p>';
    return;
  }

  // Register touch events on canvas (re-attach since canvas is now defined)
  // The listeners above already reference the canvas variable, but at the time
  // of script evaluation it was null. Re-register here.
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    if (!touchStartX && !touchStartY) return;
    e.preventDefault();

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    touchStartX = 0;
    touchStartY = 0;

    const threshold = 20;
    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
      if (state && state.state === 'gameOver') {
        startGame();
        state.lastTimestamp = 0;
        animFrameId = requestAnimationFrame(gameLoop);
      } else if (state && state.state === 'playing') {
        togglePause();
      }
      return;
    }

    let dir;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      dir = deltaX > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    } else {
      dir = deltaY > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
    }

    const dirToKey = {};
    dirToKey[DIRECTIONS.UP.x + ',' + DIRECTIONS.UP.y] = 'ArrowUp';
    dirToKey[DIRECTIONS.DOWN.x + ',' + DIRECTIONS.DOWN.y] = 'ArrowDown';
    dirToKey[DIRECTIONS.LEFT.x + ',' + DIRECTIONS.LEFT.y] = 'ArrowLeft';
    dirToKey[DIRECTIONS.RIGHT.x + ',' + DIRECTIONS.RIGHT.y] = 'ArrowRight';

    const key = dirToKey[dir.x + ',' + dir.y];
    if (key) {
      handleKeyDown({ key: key, preventDefault: function () {} }, state);
    }

    if (state && state.state === 'playing' && animFrameId === null) {
      state.lastTimestamp = 0;
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }, { passive: false });

  // Register disabled touchmove to prevent page scroll during gameplay
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  startGame();
});
