// Three ways to draw the same picture: the source frame seen through a camera,
// optionally recursed into the hero box. Tried in this order; the first that
// starts wins. All share one camera model so overlays can project through it.

export type Camera = {
  /** Centre of the view, in source-frame UV (0 to 1, y down). */
  cx: number;
  cy: number;
  /** Fraction of the source frame the view spans: 1 is the whole frame, smaller is zoomed in. */
  s: number;
  /** How many times to recurse into the hero box. 0 draws the frame once. */
  depth: number;
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

const WGSL = /* wgsl */ `
struct U { c: vec2f, s: f32, depth: f32, r0: vec2f, k: f32, pad: f32, res: vec2f, pad2: vec2f };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: U;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  return vec4f(p[i], 0.0, 1.0);
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  var p = u.c + (pos.xy / u.res - 0.5) * u.s;
  for (var i = 0; i < ${MAX_DEPTH}; i++) {
    if (f32(i) >= u.depth) { break; }
    let d = (p - u.r0) / u.k;
    if (all(d >= vec2f(0.0)) && all(d <= vec2f(1.0))) { p = d; } else { break; }
  }
  return vec4f(textureSampleLevel(tex, samp, p, 0.0).rgb, 1.0);
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
uniform vec2 res;
out vec4 o;
void main() {
  vec2 p = c + (vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / res - 0.5) * s;
  for (int i = 0; i < ${MAX_DEPTH}; i++) {
    if (float(i) >= depth) break;
    vec2 d = (p - r0) / k;
    if (all(greaterThanEqual(d, vec2(0.0))) && all(lessThanEqual(d, vec2(1.0)))) { p = d; } else { break; }
  }
  o = vec4(texture(tex, p).rgb, 1.0);
}`;

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
          0,
          canvas.width,
          canvas.height,
          0,
          0,
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
