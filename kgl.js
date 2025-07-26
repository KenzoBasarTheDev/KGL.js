// kgl.js - Kenzo Graphics Library v2 (Custom Math-Based 3D Engine)
// Lightweight 3D and 2D engine for Web, Not meant for heavy use.
export class Kgl {
  constructor(canvas) {
    if (!KGLconfig.checkConflicts('3D')) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.mouse = { x: 0, y: 0, down: false };
    this.keys = {};
    this.angleY = 0;
    this.angleX = 0;
    this.light = { x: 1, y: 1, z: -1 };

    window.addEventListener('keydown', e => this.keys[e.key] = true);
    window.addEventListener('keyup', e => this.keys[e.key] = false);
    canvas.addEventListener('mousemove', e => {
      if (this.mouse.down) {
        this.angleY += (e.movementX || 0) * 0.01;
        this.angleX += (e.movementY || 0) * 0.01;
      }
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
    });
    canvas.addEventListener('mousedown', () => this.mouse.down = true);
    canvas.addEventListener('mouseup', () => this.mouse.down = false);
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  rotate(v, ax, ay) {
    let cosY = Math.cos(ay), sinY = Math.sin(ay);
    let cosX = Math.cos(ax), sinX = Math.sin(ax);

    // Rotate around Y axis
    let xz = {
      x: v.x * cosY - v.z * sinY,
      z: v.x * sinY + v.z * cosY
    };

    // Rotate around X axis
    let yz = {
      y: v.y * cosX - xz.z * sinX,
      z: v.y * sinX + xz.z * cosX
    };

    return { x: xz.x, y: yz.y, z: yz.z };
  }

  project(v) {
    const fov = 300;
    const scale = fov / (fov + v.z);
    return {
      x: this.width / 2 + v.x * scale,
      y: this.height / 2 - v.y * scale
    };
  }

  drawSolid(vertices, faces, color = '#33f', outline = true) {
    const rotated = vertices.map(v => this.rotate(v, this.angleX, this.angleY));
    const projected = rotated.map(v => this.project(v));

    // Prepare faces with Z-depth
    const allFaces = faces.map(face => {
      const v0 = rotated[face[0]], v1 = rotated[face[1]], v2 = rotated[face[2]];
    
      // Normal
      const ux = v1.x - v0.x, uy = v1.y - v0.y, uz = v1.z - v0.z;
      const vx = v2.x - v0.x, vy = v2.y - v0.y, vz = v2.z - v0.z;
      const normal = {
        x: uy * vz - uz * vy,
        y: uz * vx - ux * vz,
        z: ux * vy - uy * vx
      };

      // Lighting
      const brightness = this.getLighting(normal);

      // Face center z (for painter's sort)
      const depth = (v0.z + v1.z + v2.z) / 3;

      return {
        points: face.map(i => projected[i]),
        brightness,
        depth
      };
    });

    // Painter's algorithm (sort back to front)
    allFaces.sort((a, b) => b.depth - a.depth);

    // Render
    allFaces.forEach(({ points, brightness }) => {
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.closePath();
      this.ctx.fillStyle = this.shade(color, brightness);
      this.ctx.fill();

      if (outline) {
        this.ctx.strokeStyle = '#0005';
        this.ctx.stroke();
      }
    });
  }

  drawTextured(vertices, faces, uvs, textureImg) {
    const rotated = vertices.map(v => this.rotate(v, this.angleX, this.angleY));
    const projected = rotated.map(v => this.project(v));

    const texCanvas = document.createElement('canvas');
    texCanvas.width = textureImg.width;
    texCanvas.height = textureImg.height;
    const texCtx = texCanvas.getContext('2d');
    texCtx.drawImage(textureImg, 0, 0);
    try {
      const texData = texCtx.getImageData(0, 0, texCanvas.width, texCanvas.height).data;
      // proceed with rendering
    } catch (err) {
      console.warn("KGL warning: Canvas tainted. Texture sampling disabled for cross-origin image.");
      return; // or fall back to untextured rendering
    }

    const putPixel = (x, y, r, g, b) => {
      this.ctx.fillStyle = `rgb(${r},${g},${b})`;
      this.ctx.fillRect(x, y, 1, 1);
    };

    const sampleTex = (u, v) => {
      const tx = Math.floor(u * textureImg.width) % textureImg.width;
      const ty = Math.floor(v * textureImg.height) % textureImg.height;
      const idx = (ty * textureImg.width + tx) * 4;
      return [
        texData[idx],
        texData[idx + 1],
        texData[idx + 2]
      ];
    };

    faces.forEach((face, fIndex) => {
      const [i0, i1, i2] = face;
      const [v0, v1, v2] = [projected[i0], projected[i1], projected[i2]];
      const [uv0, uv1, uv2] = uvs[fIndex];

      // Bounding box
      const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
      const maxX = Math.min(this.width, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
      const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
      const maxY = Math.min(this.height, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

      const edgeFunc = (a, b, c) => (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);

      const area = edgeFunc(v0, v1, v2);

      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          const p = { x, y };
          const w0 = edgeFunc(v1, v2, p);
          const w1 = edgeFunc(v2, v0, p);
          const w2 = edgeFunc(v0, v1, p);

          if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
            const alpha = w0 / area;
            const beta = w1 / area;
            const gamma = w2 / area;
  
            const u = uv0[0] * alpha + uv1[0] * beta + uv2[0] * gamma;
            const v = uv0[1] * alpha + uv1[1] * beta + uv2[1] * gamma;
  
            const [r, g, b] = sampleTex(u, v);
            putPixel(x, y, r, g, b);
          }
        }
      }
    });
  }


  getLighting(normal) {
    const len = Math.hypot(normal.x, normal.y, normal.z);
    const nx = normal.x / len;
    const ny = normal.y / len;
    const nz = normal.z / len;
    const l = this.light;
    const ln = Math.hypot(l.x, l.y, l.z);
    const lx = l.x / ln, ly = l.y / ln, lz = l.z / ln;
    return Math.max(0.2, lx * nx + ly * ny + lz * nz);
  }

  shade(hex, brightness) {
    const num = parseInt(hex.slice(1), 16);
    const r = ((num >> 16) & 255) * brightness;
    const g = ((num >> 8) & 255) * brightness;
    const b = (num & 255) * brightness;
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  updateRotation(speedX = 0.01, speedY = 0.01) {
    this.angleX += speedX;
    this.angleY += speedY;
  }
}
export class KglUI {
  constructor(kgl) {
    this.kgl = kgl;
    this.ctx = kgl.ctx;
    this.elements = [];
    this.hovered = null;

    this.kgl.canvas.addEventListener('click', (e) => {
      const x = e.offsetX, y = e.offsetY;
      for (const el of this.elements) {
        if (el.type === 'button' &&
            x >= el.x && x <= el.x + el.width &&
            y >= el.y && y <= el.y + el.height) {
          el.onClick?.();
        }
      }
    });
  }

  addButton(x, y, width, height, text, onClick, options = {}) {
    this.elements.push({ type: 'button', x, y, width, height, text, onClick, options });
  }

  addText(x, y, text, options = {}) {
    this.elements.push({ type: 'text', x, y, text, options });
  }

  addImage(x, y, img, width, height) {
    this.elements.push({ type: 'image', x, y, img, width, height });
  }

  addModal(x, y, width, height, contentFn, options = {}) {
    this.elements.push({ type: 'modal', x, y, width, height, contentFn, options });
  }

  addBackground(color) {
    this.elements.push({ type: 'background', color });
  }

  render() {
    for (const el of this.elements) {
      switch (el.type) {
        case 'background':
          this.ctx.fillStyle = el.color;
          this.ctx.fillRect(0, 0, this.kgl.width, this.kgl.height);
          break;

        case 'text':
          this.ctx.fillStyle = el.options.color || '#fff';
          this.ctx.font = el.options.font || '16px sans-serif';
          this.ctx.fillText(el.text, el.x, el.y);
          break;

        case 'button':
          this.ctx.fillStyle = el.options.bg || '#444';
          this.ctx.fillRect(el.x, el.y, el.width, el.height);
          this.ctx.strokeStyle = el.options.border || '#fff';
          this.ctx.strokeRect(el.x, el.y, el.width, el.height);
          this.ctx.fillStyle = el.options.color || '#fff';
          this.ctx.font = el.options.font || '14px sans-serif';
          this.ctx.fillText(el.text, el.x + 10, el.y + el.height / 2 + 5);
          break;

        case 'image':
          this.ctx.drawImage(el.img, el.x, el.y, el.width, el.height);
          break;

        case 'modal':
          this.ctx.fillStyle = el.options.bg || 'rgba(0,0,0,0.7)';
          this.ctx.fillRect(el.x, el.y, el.width, el.height);
          this.ctx.strokeStyle = el.options.border || '#fff';
          this.ctx.strokeRect(el.x, el.y, el.width, el.height);
          el.contentFn?.(this.ctx, el);
          break;
      }
    }
  }

  clearUI() {
    this.elements = [];
  }
}
export class Kgl2D {
  constructor(canvas) {
    if (!KGLconfig.checkConflicts('2D')) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.mouse = { x: 0, y: 0, down: false };
    this.keys = {};

    window.addEventListener('keydown', e => this.keys[e.key] = true);
    window.addEventListener('keyup', e => this.keys[e.key] = false);

    canvas.addEventListener('mousemove', e => {
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
    });
    canvas.addEventListener('mousedown', () => this.mouse.down = true);
    canvas.addEventListener('mouseup', () => this.mouse.down = false);
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  setFillColor(color) {
    this.ctx.fillStyle = color;
  }

  setStrokeColor(color) {
    this.ctx.strokeStyle = color;
  }

  setFont(font = '16px sans-serif') {
    this.ctx.font = font;
  }

  drawRect(x, y, w, h, fill = true) {
    if (fill) this.ctx.fillRect(x, y, w, h);
    else this.ctx.strokeRect(x, y, w, h);
  }

  drawCircle(x, y, r, fill = true) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.closePath();
    if (fill) this.ctx.fill();
    else this.ctx.stroke();
  }

  drawLine(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawText(text, x, y, color = '#fff') {
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  drawImage(img, x, y, w, h) {
    this.ctx.drawImage(img, x, y, w, h);
  }

  drawPolygon(points, fill = true) {
    if (points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.closePath();
    if (fill) this.ctx.fill();
    else this.ctx.stroke();
  }

  drawGrid(cellSize = 20, color = '#222') {
    this.ctx.strokeStyle = color;
    for (let x = 0; x <= this.width; x += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }

  setGlobalAlpha(alpha) {
    this.ctx.globalAlpha = alpha;
  }

  resetAlpha() {
    this.ctx.globalAlpha = 1.0;
  }

  isKeyDown(key) {
    return this.keys[key] === true;
  }

  isMouseInside(x, y, w, h) {
    return this.mouse.x >= x && this.mouse.x <= x + w &&
           this.mouse.y >= y && this.mouse.y <= y + h;
  }
}

// KGL HTSTB - HTML Display STUB (Not a stub actually)
export class KglHTSTB {
  constructor(canvas) {
    if (!KGLconfig.checkConflicts('HTSTB')) return;
    this.canvas = canvas;
    this.elements = [];
    this.container = document.createElement('div');
    this.container.style.position = 'relative';
    this.container.style.width = canvas.width + 'px';
    this.container.style.height = canvas.height + 'px';
    this.container.style.pointerEvents = 'none'; // Allow canvas to still handle events

    canvas.parentNode.insertBefore(this.container, canvas);
    this.container.appendChild(canvas);
  }

  createBox(x, y, width, height, html, options = {}) {
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    el.style.color = options.color || '#fff';
    el.style.background = options.background || '#222';
    el.style.border = options.border || '1px solid #555';
    el.style.font = options.font || '14px sans-serif';
    el.style.padding = options.padding || '5px';
    el.style.overflow = options.overflow || 'auto';
    el.style.pointerEvents = 'auto'; // Allow interaction

    this.container.appendChild(el);
    this.elements.push(el);
    return el;
  }

  clear() {
    for (const el of this.elements) {
      el.remove();
    }
    this.elements = [];
  }

  resize(width, height) {
    this.container.style.width = width + 'px';
    this.container.style.height = height + 'px';
  }
}

export class KGLconfig {
  static UseFaceCulling = false;
  static DisableHTSTB = false;
  static Disable2D = false;
  static Disable3D = false;

  static File2D = false;
  static File3D = false;
  static FileUI = false;

  static IsInDev = false;

  static AppName = "Untitled App";
  static Version = "0.0.1";

  static set(options = {}) {
    for (let key in options) {
      if (key in KGLconfig) {
        KGLconfig[key] = options[key];
      }
    }
  }

  static info() {
    return {
      AppName: KGLconfig.AppName,
      Version: KGLconfig.Version,
      Mode: KGLconfig.IsInDev ? "Development" : "Production"
    };
  }

  static isEnabled(feature) {
    return KGLconfig[feature] === true;
  }

  static checkConflicts(component) {
    // Throw error if face culling used in 2D
    if (KGLconfig.UseFaceCulling && component === '2D') {
      throw new Error("KGL error : 500 (Face culling is not for 2D)");
    }

    // Prevent component if globally disabled
    if (component === '2D' && KGLconfig.Disable2D) return false;
    if (component === '3D' && KGLconfig.Disable3D) return false;
    if (component === 'HTSTB' && KGLconfig.DisableHTSTB) return false;

    return true;
  }
}
export class KglUtilities {
  static WriteErrorsInCanvas = false;
  static Opt = false;

  static initSoundSystem() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn("KGLUtilities: Web Audio API not supported.");
      return;
    }
    KglUtilities.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  static playSound(url) {
    if (!KglUtilities.audioCtx) {
      KglUtilities.initSoundSystem();
    }
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(data => KglUtilities.audioCtx.decodeAudioData(data))
      .then(buffer => {
        const source = KglUtilities.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(KglUtilities.audioCtx.destination);
        source.start(0);
      })
      .catch(err => {
        KglUtilities._handleError("Audio Error: " + err.message);
      });
  }

  static optimize3D(kglInstance) {
    if (!KglUtilities.Opt || !kglInstance || !kglInstance.ctx) return;

    // Basic optimization: reduce anti-aliasing artifacts with pixel snapping
    kglInstance.ctx.imageSmoothingEnabled = false;

    // Pre-render lighting vectors or any matrix caching logic (dummy example)
    kglInstance.light = {
      x: (kglInstance.light.x / 2).toFixed(3),
      y: (kglInstance.light.y / 2).toFixed(3),
      z: (kglInstance.light.z / 2).toFixed(3)
    };
  }

  static writeErrorToCanvas(canvas, message) {
    if (!KglUtilities.WriteErrorsInCanvas || !canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.font = '12px Tahoma';
    ctx.fillStyle = '#f55';
    ctx.fillText(message, 5, 15);
  }

  static _handleError(message) {
    console.error("KGL Error:", message);
    if (KglUtilities.WriteErrorsInCanvas && document.querySelector('canvas')) {
      KglUtilities.writeErrorToCanvas(document.querySelector('canvas'), message);
    }
  }
}
export class KGLvoxel {
  constructor(kgl, chunkSize = 16) {
    this.kgl = kgl;
    this.chunkSize = chunkSize;
    this.voxelSize = 20;
    this.chunks = new Map(); // Map<string, Voxel[]>
  }

  _getChunkKey(x, y, z) {
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    return `${cx},${cy},${cz}`;
  }

  addVoxel(x, y, z, color = '#6cf') {
    const key = this._getChunkKey(x, y, z);
    if (!this.chunks.has(key)) this.chunks.set(key, []);
    this.chunks.get(key).push({ x, y, z, color });
  }

  removeVoxel(x, y, z) {
    const key = this._getChunkKey(x, y, z);
    if (!this.chunks.has(key)) return;
    const list = this.chunks.get(key);
    this.chunks.set(key, list.filter(v => v.x !== x || v.y !== y || v.z !== z));
  }

  getVisibleChunkKeys(center, viewDistance = 2) {
    const keys = [];
    const baseX = Math.floor(center.x / this.chunkSize);
    const baseY = Math.floor(center.y / this.chunkSize);
    const baseZ = Math.floor(center.z / this.chunkSize);

    for (let dx = -viewDistance; dx <= viewDistance; dx++) {
      for (let dy = -viewDistance; dy <= viewDistance; dy++) {
        for (let dz = -viewDistance; dz <= viewDistance; dz++) {
          const key = `${baseX + dx},${baseY + dy},${baseZ + dz}`;
          if (this.chunks.has(key)) {
            keys.push(key);
          }
        }
      }
    }
    return keys;
  }

  drawVisibleChunks(playerPos = { x: 0, y: 0, z: 0 }) {
    const visibleKeys = this.getVisibleChunkKeys(playerPos);
    for (const key of visibleKeys) {
      const voxels = this.chunks.get(key);
      for (const voxel of voxels) {
        this._drawVoxelCube(voxel);
      }
    }
  }

  _drawVoxelCube({ x, y, z, color }) {
    const s = this.voxelSize / 2;
    const v = [
      { x: x - s, y: y - s, z: z - s }, { x: x + s, y: y - s, z: z - s },
      { x: x + s, y: y + s, z: z - s }, { x: x - s, y: y + s, z: z - s },
      { x: x - s, y: y - s, z: z + s }, { x: x + s, y: y - s, z: z + s },
      { x: x + s, y: y + s, z: z + s }, { x: x - s, y: y + s, z: z + s },
    ];
    const f = [
      [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
      [3, 2, 6, 7], [1, 2, 6, 5], [0, 3, 7, 4]
    ];
    this.kgl.drawSolid(v, f, color);
  }

  clearChunks() {
    this.chunks.clear();
  }

  voxelCount() {
    let total = 0;
    for (const list of this.chunks.values()) {
      total += list.length;
    }
    return total;
  }
}
export class KGLentity {
  constructor(kgl) {
    this.kgl = kgl;
    this.entities = [];
  }

  addEntity({ position = { x: 0, y: 0, z: 0 }, color = '#f55', model = null, behavior = null }) {
    const entity = {
      id: crypto.randomUUID(),
      pos: position,
      color,
      model, // { vertices: [...], faces: [...] }
      behavior, // function(entity, deltaTime)
    };
    this.entities.push(entity);
    return entity.id;
  }

  removeEntityById(id) {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  update(deltaTime = 1 / 60) {
    for (const entity of this.entities) {
      if (typeof entity.behavior === 'function') {
        entity.behavior(entity, deltaTime);
      }
    }
  }

  drawEntities() {
    for (const entity of this.entities) {
      if (entity.model) {
        const offsetVerts = entity.model.vertices.map(v => ({
          x: v.x + entity.pos.x,
          y: v.y + entity.pos.y,
          z: v.z + entity.pos.z
        }));
        this.kgl.drawSolid(offsetVerts, entity.model.faces, entity.color);
      } else {
        // fallback: draw small cube
        const s = 10;
        const v = [
          { x: entity.pos.x - s, y: entity.pos.y - s, z: entity.pos.z - s },
          { x: entity.pos.x + s, y: entity.pos.y - s, z: entity.pos.z - s },
          { x: entity.pos.x + s, y: entity.pos.y + s, z: entity.pos.z - s },
          { x: entity.pos.x - s, y: entity.pos.y + s, z: entity.pos.z - s },
          { x: entity.pos.x - s, y: entity.pos.y - s, z: entity.pos.z + s },
          { x: entity.pos.x + s, y: entity.pos.y - s, z: entity.pos.z + s },
          { x: entity.pos.x + s, y: entity.pos.y + s, z: entity.pos.z + s },
          { x: entity.pos.x - s, y: entity.pos.y + s, z: entity.pos.z + s },
        ];
        const f = [
          [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
          [3, 2, 6, 7], [1, 2, 6, 5], [0, 3, 7, 4]
        ];
        this.kgl.drawSolid(v, f, entity.color);
      }
    }
  }

  getEntityById(id) {
    return this.entities.find(e => e.id === id);
  }

  clear() {
    this.entities = [];
  }

  count() {
    return this.entities.length;
  }
}
export class KGLscene {
  constructor(kgl) {
    this.kgl = kgl;
    this.scenes = new Map(); // Map<string, {onLoad, onUpdate, onDraw, onUnload}>
    this.currentScene = null;
    this.sceneData = {}; // Shared between scenes if needed
  }

  createScene(name, { onLoad = () => {}, onUpdate = () => {}, onDraw = () => {}, onUnload = () => {} } = {}) {
    this.scenes.set(name, { onLoad, onUpdate, onDraw, onUnload });
  }

  switchScene(name) {
    if (!this.scenes.has(name)) {
      console.warn(`KGLscene: Scene "${name}" does not exist.`);
      return;
    }

    if (this.currentScene && this.scenes.get(this.currentScene).onUnload) {
      this.scenes.get(this.currentScene).onUnload(this.sceneData);
    }

    this.currentScene = name;
    this.scenes.get(name).onLoad?.(this.sceneData);
  }

  update(deltaTime = 1 / 60) {
    if (!this.currentScene) return;
    const scene = this.scenes.get(this.currentScene);
    scene.onUpdate?.(deltaTime, this.sceneData);
  }

  render() {
    if (!this.currentScene) return;
    const scene = this.scenes.get(this.currentScene);
    scene.onDraw?.(this.kgl.ctx, this.sceneData);
  }

  deleteScene(name) {
    if (this.currentScene === name) this.currentScene = null;
    this.scenes.delete(name);
  }

  clearScenes() {
    this.scenes.clear();
    this.currentScene = null;
  }
}

