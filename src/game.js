// Glue code: input, main loop, and linking Engine + WorldGen

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let state = Engine.createState('my-awesome-seed');
let lastTime = 0;

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    state.input.left = true;
    e.preventDefault();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    state.input.right = true;
    e.preventDefault();
  }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    state.input.jumpQueued = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    state.input.left = false;
    e.preventDefault();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    state.input.right = false;
    e.preventDefault();
  }
});

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  if (dt > 0.05) dt = 0.05;
  lastTime = timestamp;

  Engine.update(state, dt);
  Engine.draw(state, canvas, ctx);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
