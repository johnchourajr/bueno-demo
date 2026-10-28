// Three ways to draw the same picture: the source frame seen through a camera,
// optionally recursed into the hero box. Tried in this order; the first that
// starts wins. All share one camera model so overlays can project through it.
// The GPU renderers also have a focal plane: each nesting level is one unit of
// depth, and anything off the plane breaks up into an ordered dither rather
// than a soft blur. Canvas 2D skips the focus and draws everything sharp.

export type Camera = {
  /** Centre of the view, in source-frame UV (0 to 1, y down). */
  cx: number;
  cy: number;
  /** Fraction of the source frame the view spans: 1 is the whole frame, smaller is zoomed in. */
  s: number;
  /** How many times to recurse into the hero box. 0 draws the frame once. */
  depth: number;
  /** The nesting level in focus. 0 is the outer frame, 1 the page inside the hero box. */
  focus: number;
  /** Extra defocus for the whole frame, in levels. The camera adds some while it travels. */
  blur: number;
};

export type HeroBox = {
  /** Top-left corner of the hero box, in source-frame UV. */
  x: number;
  y: number;
  /** The box's size as a fraction of the frame. It keeps the frame's aspect, so one number covers both axes. */
  k: number;
};

export type Renderer = {
  name: "WebGPU" | "WebGL2" | "Canvas 2D";
  draw: (source: HTMLCanvasElement, camera: Camera, box: HeroBox) => void;
  destroy: () => void;
};

const MAX_DEPTH = 12;

// Defocus in levels: under 0.08 is sharp, from there the dither fades in, and
// its cells grow from one to four CSS pixels as the distance reaches two levels.
const WGSL = /* wgsl */ `
struct U { c: vec2f, s: f32, depth: f32, r0: vec2f, k: f32, focus: f32, res: vec2f, blur: f32, px: f32 };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: U;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  return vec4f(p[i], 0.0, 1.0);
}

// Frame UV in xy, nesting level in z.
fn look(pos: vec2f) -> vec3f {
  var p = u.c + (pos / u.res - 0.5) * u.s;
  var n = 0.0;
  for (var i = 0; i < ${MAX_DEPTH}; i++) {
    if (f32(i) >= u.depth) { break; }
    let d = (p - u.r0) / u.k;
    if (all(d >= vec2f(0.0)) && all(d <= vec2f(1.0))) { p = d; n += 1.0; } else { break; }
  }
  return vec3f(p, n);
}

fn tap(pos: vec2f) -> vec3f {
  return textureSampleLevel(tex, samp, look(pos).xy, 0.0).rgb;
}

fn bayer2(x: u32, y: u32) -> u32 { return ((x ^ y) & 1u) * 2u + (y & 1u); }

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let here = look(pos.xy);
  let sharp = textureSampleLevel(tex, samp, here.xy, 0.0).rgb;
  let dz = min(abs(here.z - u.focus) + u.blur, 2.0);
  let amount = smoothstep(0.08, 0.4, dz);
  if (amount <= 0.0) { return vec4f(sharp, 1.0); }
  let cell = (1.0 + floor(dz * 1.5)) * u.px;
  let id = floor(pos.xy / cell);
  let q = (id + 0.5) * cell;
  // Spread before dithering so edges bloom into stippled halos, wider the further off the plane.
  let r = dz * 4.0 * u.px;
  var soft = tap(q);
  for (var i = 0; i < 8; i++) {
    let a = f32(i) * 0.785398;
    soft += tap(q + vec2f(cos(a), sin(a)) * r);
  }
  soft /= 9.0;
  let x = u32(id.x);
  let y = u32(id.y);
  let threshold = (f32(bayer2(x, y) * 4u + bayer2(x >> 1u, y >> 1u)) + 0.5) / 16.0;
  // One bit per pixel, keeping each colour's hue: lit at full brightness or off.
  let m = max(soft.r, max(soft.g, soft.b));
  let lit = select(vec3f(0.0), soft / max(m, 0.001), m > threshold);
  return vec4f(mix(sharp, lit, amount), 1.0);
}
`;

const GLSL_VS = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const GLSL_FS = `#version 300 es
precision highp float;
uniform sampler2D tex;
uniform vec2 c;
uniform float s;
uniform float depth;
uniform vec2 r0;
uniform float k;
uniform float focus;
uniform float blur;
uniform float px;
uniform vec2 res;
out vec4 o;

vec3 look(vec2 pos) {
  vec2 p = c + (pos / res - 0.5) * s;
  float n = 0.0;
  for (int i = 0; i < ${MAX_DEPTH}; i++) {
    if (float(i) >= depth) break;
    vec2 d = (p - r0) / k;
    if (all(greaterThanEqual(d, vec2(0.0))) && all(lessThanEqual(d, vec2(1.0)))) { p = d; n += 1.0; } else { break; }
  }
  return vec3(p, n);
}

vec3 tap(vec2 pos) { return texture(tex, look(pos).xy).rgb; }

int bayer2(int x, int y) { return ((x ^ y) & 1) * 2 + (y & 1); }

void main() {
  vec2 pos = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec3 here = look(pos);
  vec3 sharp = texture(tex, here.xy).rgb;
  float dz = min(abs(here.z - focus) + blur, 2.0);
  float amount = smoothstep(0.08, 0.4, dz);
  if (amount <= 0.0) { o = vec4(sharp, 1.0); return; }
  float cell = (1.0 + floor(dz * 1.5)) * px;
  vec2 id = floor(pos / cell);
  vec2 q = (id + 0.5) * cell;
  float r = dz * 4.0 * px;
  vec3 soft = tap(q);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    soft += tap(q + vec2(cos(a), sin(a)) * r);
  }
  soft /= 9.0;
  int x = int(id.x);
  int y = int(id.y);
  float threshold = (float(bayer2(x, y) * 4 + bayer2(x >> 1, y >> 1)) + 0.5) / 16.0;
  float m = max(soft.r, max(soft.g, soft.b));
  vec3 lit = m > threshold ? soft / max(m, 0.001) : vec3(0.0);
  o = vec4(mix(sharp, lit, amount), 1.0);
}`;

/** Device pixels per CSS pixel, so dither cells stay the same size on any screen. */
const pixelRatio = (canvas: HTMLCanvasElement) =>
  canvas.width / Math.max(1, canvas.clientWidth);

async function webgpu(canvas: HTMLCanvasElement): Promise<Renderer | null> {
  if (!("gpu" in navigator)) return null;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const shader = device.createShaderModule({ code: WGSL });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: shader, entryPoint: "vs" },
    fragment: { module: shader, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const uniforms = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  let texture: GPUTexture | null = null;
  let bindGroup: GPUBindGroup | null = null;

  return {
    name: "WebGPU",
    draw(source, cam, box) {
      if (
        !texture ||
        texture.width !== source.width ||
        texture.height !== source.height
      ) {
        texture?.destroy();
        texture = device.createTexture({
          size: [source.width, source.height],
          format: "rgba8unorm",
          usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
        });
        bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: texture.createView() },
            { binding: 2, resource: { buffer: uniforms } },
          ],
        });
      }
      device.queue.copyExternalImageToTexture({ source }, { texture }, [
        source.width,
        source.height,
      ]);
      device.queue.writeBuffer(
        uniforms,
        0,
        new Float32Array([
          cam.cx,
          cam.cy,
          cam.s,
          cam.depth,
          box.x,
          box.y,
          box.k,
          cam.focus,
          canvas.width,
          canvas.height,
          cam.blur,
          pixelRatio(canvas),
        ]),
      );
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear" as const,
            storeOp: "store" as const,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      texture?.destroy();
      device.destroy();
    },
  };
}

function webgl2(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl2");
  if (!gl) return null;

  const compile = (type: number, code: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed");
    }
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, GLSL_VS));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, GLSL_FS));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -3, -1, 1, 3, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const at = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    c: at("c"),
    s: at("s"),
    depth: at("depth"),
    r0: at("r0"),
    k: at("k"),
    focus: at("focus"),
    blur: at("blur"),
    px: at("px"),
    res: at("res"),
  };

  return {
    name: "WebGL2",
    draw(source, cam, box) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      gl.uniform2f(loc.c, cam.cx, cam.cy);
      gl.uniform1f(loc.s, cam.s);
      gl.uniform1f(loc.depth, cam.depth);
      gl.uniform2f(loc.r0, box.x, box.y);
      gl.uniform1f(loc.k, box.k);
      gl.uniform1f(loc.focus, cam.focus);
      gl.uniform1f(loc.blur, cam.blur);
      gl.uniform1f(loc.px, pixelRatio(canvas));
      gl.uniform2f(loc.res, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** Plain transforms: the nesting is drawn outside in, each copy shrunk into the box. */
export function canvas2d(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d")!;
  return {
    name: "Canvas 2D",
    draw(source, cam, box) {
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      // Screen = (frame - c) / s + 0.5, in pixels.
      ctx.translate(W / 2, H / 2);
      ctx.scale(1 / cam.s, 1 / cam.s);
      ctx.translate(-cam.cx * W, -cam.cy * H);
      const levels = Math.min(cam.depth, 8);
      for (let i = 0; i <= levels; i++) {
        ctx.drawImage(source, 0, 0, W, H);
        ctx.translate(box.x * W, box.y * H);
        ctx.scale(box.k, box.k);
      }
    },
    destroy() {},
  };
}

/**
 * Starts the best renderer the browser has. Each attempt gets a fresh canvas,
 * because a canvas keeps whichever context type it handed out first.
 */
export async function startRenderer(
  host: HTMLElement,
  className: string,
): Promise<{ renderer: Renderer; canvas: HTMLCanvasElement }> {
  const attempts: Array<
    (c: HTMLCanvasElement) => Promise<Renderer | null> | Renderer | null
  > = [webgpu, webgl2, canvas2d];
  for (const attempt of attempts) {
    const canvas = document.createElement("canvas");
    canvas.className = className;
    canvas.setAttribute("aria-hidden", "true");
    try {
      const renderer = await attempt(canvas);
      if (renderer) {
        host.replaceChildren(canvas);
        return { renderer, canvas };
      }
    } catch {
      // Fall through to the next renderer.
    }
  }
  throw new Error("No renderer could start");
}
