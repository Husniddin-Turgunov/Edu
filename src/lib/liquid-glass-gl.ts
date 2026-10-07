"use client";

/**
 * Liquid Glass — GPU renderer (liquid-glass-studio sxemasi bo'yicha).
 *
 * Nima qiladi:
 *   * barcha glass elementlar bitta SDF maydonida `smin` bilan birlashtiriladi
 *     (repo: lib/sdf.glsl, mainSDF) — yaqin shakllar suvday qo'shiladi;
 *   * chetga yaqin joyda analitik normal (repo: getNormal3) hisoblanadi;
 *   * refraction edgeFactor (repo: STEP 9), fresnel va glare (repo: STEP 8/9)
 *     GPU fragment shader'ida bajariladi;
 *   * natija — bitta canvas, bitta draw call, ARM64/Mali/Adreno ham mos.
 *
 * Backdrop haqiqiy sahifa matni bo'lgani uchun quyuqlashtirish CSS
 * `backdrop-filter` orqali qilinadi (liquid-glass-shader.ts -> SVG feDisplacementMap),
 * bu canvas esa shisha terisi, fresnel va specular yorug'likni beradi.
 */

export const MAX_GPU_SHAPES = 48;

export type GpuShape = {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  radius: number;
  roundness: number;
  k: number;
  alpha: number;
};

export type GpuParams = {
  refThickness: number;
  refDistance: number;
  refFactor: number;
  refDispersion: number;
  refFresnelRange: number;
  refFresnelHardness: number;
  refFresnelFactor: number;
  glareRange: number;
  glareHardness: number;
  glareFactor: number;
  glareConvergence: number;
  glareOppositeFactor: number;
  glareAngle: number;
  tint: [number, number, number, number];
};

const VERT = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/* fragment shader — repo fragment-main.glsl (STEP 9) + ko'p shakl (u_shape[]) */
const FRAG = `#version 300 es
precision highp float;

#define PI 3.14159265359
#define MAX_SHAPES ${MAX_GPU_SHAPES}

in vec2 v_uv;
out vec4 fragColor;

uniform vec2  u_resolution;
uniform float u_dpr;
uniform int   u_count;
uniform vec4  u_shape[MAX_SHAPES];   // cx, cy, halfW, halfH  (CSS px)
uniform vec4  u_shapeP[MAX_SHAPES];  // radius, roundness, k, alpha
uniform vec2  u_cursor;
uniform float u_cursorR;
uniform float u_cursorOn;
uniform float u_cursorK;
uniform float u_viewH;

uniform float u_refThickness;
uniform float u_refDistance;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelHardness;
uniform float u_refFresnelFactor;
uniform float u_glareRange;
uniform float u_glareHardness;
uniform float u_glareFactor;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_glareAngle;
uniform vec4  u_tint;

float safeAsin(float x) { return asin(clamp(x, -1.0, 1.0)); }

// repo: superellipseCornerSDF
float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

// repo: roundedRectSDF (CSS px -> px scaled by dpr yo'q, hammasi CSS px)
float roundedRectSDF(vec2 p, vec2 c, float w, float h, float cr, float n) {
  p -= c;
  cr = min(cr, min(w, h) * 0.5);
  vec2 d = abs(p) - vec2(w, h) * 0.5;
  if (d.x > -cr && d.y > -cr) {
    vec2 cornerCenter = sign(p) * (vec2(w, h) * 0.5 - vec2(cr));
    return superellipseCornerSDF(p - cornerCenter, cr, n);
  }
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// repo: smin
float smin(float a, float b, float k) {
  if (k <= 0.001) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float mergedSDF(vec2 p, out float alpha) {
  float d = 1e9;
  alpha = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= u_count) break;
    vec4 s = u_shape[i];
    vec4 sp = u_shapeP[i];
    // tezlik: shakl kvadratiga yaqin bo'lmasa tashlab ketamiz
    vec2 dc = abs(p - s.xy) - vec2(s.z, s.w);
    if (dc.x > 16.0 && dc.y > 16.0) continue;
    float dd = roundedRectSDF(p, s.xy, s.z * 2.0, s.w * 2.0, sp.x, sp.y);
    d = smin(d, dd, sp.z);
    alpha = max(alpha, sp.w);
  }
  if (u_cursorOn > 0.5 && u_cursorR > 0.5) {
    d = smin(d, length(p - u_cursor) - u_cursorR, u_cursorK);
    alpha = max(alpha, 1.0);
  }
  return d;
}

float vec2ToAngle(vec2 v) {
  float a = atan(v.y, v.x);
  if (a < 0.0) a += 2.0 * PI;
  return a;
}

void main() {
  // gl_FragCoord.y pastdan yuqoriga hisoblanadi, DOM esa yuqoridan pastga
  vec2 p = vec2(gl_FragCoord.x / u_dpr, u_viewH - gl_FragCoord.y / u_dpr);
  float shapeAlpha;
  float merged = mergedSDF(p, shapeAlpha);
  // shakl tashqarisida — butunlay chizilmaydi
  if (merged > 0.0) discard;
  float alpha = shapeAlpha;

  float nmerged = -merged;                     // chekkadan ichkariga masofa (px)

  // repo STEP 9: refraction edgeFactor
  float edge = 0.0;
  if (nmerged < u_refThickness && nmerged > 0.0) {
    float xr = 1.0 - nmerged / u_refThickness;
    float thetaI = safeAsin(pow(xr, 2.0));
    float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
    edge = -tan(thetaT - thetaI);
    edge = max(edge, 0.0);
  }

  // repo: fresnelFactor / glareGeoFactor
  float fBase = max(0.0, 1.0 + merged / 60.0 * pow(500.0 / max(u_refFresnelRange, 1.0), 2.0) * 0.01 + u_refFresnelHardness / 100.0);
  float fresnel = clamp(pow(fBase, 3.0), 0.0, 1.0);
  float gBase = max(0.0, 1.0 + merged / 60.0 * pow(500.0 / max(u_glareRange, 1.0), 2.0) * 0.01 + u_glareHardness / 100.0);
  float glareGeo = clamp(pow(gBase, 3.0), 0.0, 1.0);

  // normal faqat chekka yaqinlikda (ARM/Mali uchun arzon)
  vec2 nrm = vec2(0.0);
  float glare = 0.0;
  if (edge > 0.0 || fresnel > 0.001 || glareGeo > 0.001) {
    float e = 0.75;
    float a1;
    float dX = mergedSDF(p + vec2(e, 0.0), a1) - mergedSDF(p - vec2(e, 0.0), a1);
    float dY = mergedSDF(p + vec2(0.0, e), a1) - mergedSDF(p - vec2(0.0, e), a1);
    float len = length(vec2(dX, dY));
    if (len > 0.0001) {
      nrm = vec2(dX, dY) / len;
      // repo STEP 9 glare: burchakka bog'liq specular dog'
      float ang = (vec2ToAngle(nrm) - PI / 4.0 + u_glareAngle * PI / 180.0) * 2.0;
      int far = 0;
      if (ang > PI * 1.5 && ang < PI * 3.5 || ang < -PI * 0.5) far = 1;
      float gaf = (0.5 + sin(ang) * 0.5) * (far == 1 ? 1.2 * u_glareOppositeFactor / 100.0 : 1.2) * (u_glareFactor / 100.0);
      gaf = clamp(pow(max(gaf, 0.0), 0.1 + u_glareConvergence / 100.0 * 2.0), 0.0, 1.0);
      glare = gaf * glareGeo;
    }
  }

  // shisha terisi: tint + fresnel yorug'ligi + specular + chetda quyuqroq
  float depth = clamp(1.0 - nmerged / 30.0, 0.0, 1.0);
  // shisha tanasi: chetdan ichkariga yengilroq
  float bodyA = u_tint.a * (0.10 + 0.26 * pow(depth, 0.55)) * alpha;
  // fresnel — nozik yorug'lik halqasi (chetda)
  float fresnelA = pow(fresnel, 0.9) * (u_refFresnelFactor / 100.0) * 1.35 * alpha;
  // specular — kichik, keskin
  float glareA = pow(clamp(glare, 0.0, 1.0), 1.1) * 0.7 * alpha;

  vec3 col = u_tint.rgb;
  col = mix(col, vec3(1.0), clamp(fresnel * (u_refFresnelFactor / 100.0) * 0.9, 0.0, 1.0));
  col = mix(col, vec3(1.0), clamp(glare * 0.85, 0.0, 1.0));

  float a = clamp(bodyA + fresnelA + glareA, 0.0, 0.92);
  if (a < 0.006) discard;
  // premultiplied alpha bilan chiqaramiz (ONE, ONE_MINUS_SRC_ALPHA)
  fragColor = vec4(col * a, a);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (typeof console !== "undefined") console.warn("[liquid-glass] shader:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export type GlRenderer = {
  ok: boolean;
  canvas: HTMLCanvasElement;
  render: (shapes: GpuShape[], cursor: { x: number; y: number; r: number; on: boolean }, p: GpuParams) => void;
  resize: (w: number, h: number, dpr: number) => void;
  dispose: () => void;
};

/**
 * WebGL2 renderer yaratadi. WebGL2 yo'q bo'lsa `ok: false` — CSS qatlami
 * (backdrop-filter) baribir ishlayveradi.
 */
export function createGlRenderer(): GlRenderer | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.className = "lg-layer";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (typeof console !== "undefined") console.warn("[liquid-glass] link:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uShape = U("u_shape");
  const uShapeP = U("u_shapeP");
  const shapeBuf = new Float32Array(MAX_GPU_SHAPES * 4);
  const shapePBuf = new Float32Array(MAX_GPU_SHAPES * 4);

  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied

  let dpr = 1;

  const render = (shapes: GpuShape[], cursor: { x: number; y: number; r: number; on: boolean }, p: GpuParams) => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const n = Math.min(shapes.length, MAX_GPU_SHAPES);
    for (let i = 0; i < n; i++) {
      const s = shapes[i];
      shapeBuf[i * 4] = s.cx;
      shapeBuf[i * 4 + 1] = s.cy;
      shapeBuf[i * 4 + 2] = Math.max(1, s.hw);
      shapeBuf[i * 4 + 3] = Math.max(1, s.hh);
      shapePBuf[i * 4] = s.radius;
      shapePBuf[i * 4 + 1] = s.roundness;
      shapePBuf[i * 4 + 2] = s.k;
      shapePBuf[i * 4 + 3] = s.alpha;
    }
    gl.uniform4fv(uShape, shapeBuf);
    gl.uniform4fv(uShapeP, shapePBuf);
    gl.uniform1i(U("u_count"), n);
    gl.uniform2f(U("u_resolution"), canvas.width, canvas.height);
    gl.uniform1f(U("u_dpr"), dpr);
    gl.uniform2f(U("u_cursor"), cursor.x, cursor.y);
    gl.uniform1f(U("u_viewH"), canvas.height / dpr);
    gl.uniform1f(U("u_cursorR"), cursor.r);
    gl.uniform1f(U("u_cursorOn"), cursor.on ? 1 : 0);
    gl.uniform1f(U("u_cursorK"), 14.0);
    gl.uniform1f(U("u_refThickness"), p.refThickness);
    gl.uniform1f(U("u_refDistance"), p.refDistance);
    gl.uniform1f(U("u_refFactor"), p.refFactor);
    gl.uniform1f(U("u_refDispersion"), p.refDispersion);
    gl.uniform1f(U("u_refFresnelRange"), p.refFresnelRange);
    gl.uniform1f(U("u_refFresnelHardness"), p.refFresnelHardness);
    gl.uniform1f(U("u_refFresnelFactor"), p.refFresnelFactor);
    gl.uniform1f(U("u_glareRange"), p.glareRange);
    gl.uniform1f(U("u_glareHardness"), p.glareHardness);
    gl.uniform1f(U("u_glareFactor"), p.glareFactor);
    gl.uniform1f(U("u_glareConvergence"), p.glareConvergence);
    gl.uniform1f(U("u_glareOppositeFactor"), p.glareOppositeFactor);
    gl.uniform1f(U("u_glareAngle"), p.glareAngle);
    gl.uniform4f(U("u_tint"), p.tint[0], p.tint[1], p.tint[2], p.tint[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    ok: true,
    canvas,
    render,
    resize: (w, h, ratio) => {
      dpr = Math.min(ratio || 1, 2);
      const cw = Math.max(1, Math.round(w * dpr));
      const ch = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      gl.viewport(0, 0, cw, ch);
    },
    dispose: () => {
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      canvas.remove();
    },
  };
}