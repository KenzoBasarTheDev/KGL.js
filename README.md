# Kenzo Graphics Library v2 (KGL)

Kenzo Graphics Library (KGL) is a lightweight, math-based 2D and 3D engine for web-based applications and games. Designed for speed, simplicity, and small-scale use, KGL enables fast prototyping and educational graphics applications in HTML environments without external dependencies.

## Key Features

* 2D and 3D rendering via `<canvas>`
* UI elements (buttons, modals, images, etc.)
* Texturing, shading, and lighting simulation
* Built-in input handling for mouse and keyboard
* HTML/HTA integration support via HTSTB system

---

## Getting Started

### HTML Setup

```html
<canvas id="myCanvas" width="640" height="480"></canvas>
<script src="kgl.js"></script>
<script>
  const canvas = document.getElementById('myCanvas');
  const kgl = new Kgl(canvas);

  function animate() {
    kgl.clear();
    kgl.updateRotation();
    kgl.drawSolid(vertices, faces);
    requestAnimationFrame(animate);
  }

  animate();
</script>
```

### HTA Usage (Windows Desktop App Style)

```html
<!DOCTYPE html>
<hta:application>
<html>
<body>
<canvas id="c" width="640" height="480"></canvas>
<script src="kgl.js"></script>
<script>
  const canvas = document.getElementById('c');
  const kgl = new Kgl(canvas);
  const ui = new KglUI(kgl);
  const htmlBox = new KglHTSTB(canvas);
  htmlBox.createBox(10, 10, 200, 100, "<b>Hello from HTA</b>");
</script>
</body>
</html>
```

---

## Best Practices for Lightweight Games

* **Minimize Faces:** Use low-poly models for 3D.
* **Reuse Buffers:** Avoid regenerating geometry or textures each frame.
* **Limit Draw Calls:** Batch rendering where possible.
* **Turn Off What You Don’t Use:** Use `KGLconfig.Disable3D` or `Disable2D` when appropriate.
* **Optimize Loops:** Keep animations and calculations efficient.

---

## Debugging Guide

### Common Errors

* **Face Culling in 2D**

  * Error: `KGL error : 500 (Face culling is not for 2D)`
  * Fix: Set `KGLconfig.UseFaceCulling = false` before initializing a `Kgl2D` instance.

* **Canvas Tainted by Cross-Origin Texture**

  * Warning: `KGL warning: Canvas tainted...`
  * Fix: Load textures from same origin or ensure CORS is configured correctly.

* **Disabled Components Not Loading**

  * If `KGLconfig.Disable2D = true`, `Kgl2D` will not initialize.
  * Fix: Ensure correct config flags are set before using components.

### Tips

* Use `KGLconfig.IsInDev = true` to enable dev-mode behavior.
* Call `KGLconfig.info()` to print current configuration.
* Use browser devtools to set breakpoints in animation loops.

---

## Configuration

Set flags before creating components:

```js
KGLconfig.set({
  AppName: "My Mini Game",
  UseFaceCulling: true,
  Disable2D: false,
  DisableHTSTB: false
});
```

---

## Examples

* **3D Cube with UI**
* **2D Platformer Prototype**
* **HTA Tool with Canvas Buttons and Info Panels**

Explore the `KglUI`, `Kgl2D`, and `KglHTSTB` classes for ready-made UI and layout tools.

---

## Final Notes

KGL is ideal for indie experiments, educational demos, and rapid prototyping. While it's not intended for complex or physics-heavy projects, it remains highly extensible for creative and compact visual interfaces.
Happy coding!

# Notes 

This is not related to **kgl-jogl-js** or any other APIs 
# CDN/LINKS

[JSdelivr](https://cdn.jsdelivr.net/gh/KenzoBasarTheDev/KGL.js@master/kgl.js)
[NPM](https://www.npmjs.com/package/kenzo-graphics-library-v2)
