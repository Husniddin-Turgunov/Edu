// liquid-glass-studio (iyinchao/liquid-glass-studio) shaderlaridan olingan GLSL.
// Manba: src/shaders/fragment-main.glsl (STEP 9), src/shaders/lib/sdf.glsl,
//        src/shaders/lib/math.glsl (MIT).
// Farq: bitta ekran emas, bitta shisha element ko'rsatiladi —
//   * `p` = element ichidagi lokal piksel (markazga nisbatan);
//   * `guv` = elementning butun ekrandagi o'rni (matna global uv).
// Sinish, dispersiya, fresnel va glare — repo formulalari aynan saqlangan.

export const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const FRAG = `#version 300 es
precision highp float;

#define PI 3.14159265359

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_bg;          // xiralanmagan fon (global uv)
uniform sampler2D u_blurredBg;  // blur qilingan fon (global uv)
uniform vec2 u_res;             // element o'lchami, px
uniform float u_dpr;
uniform float u_radius;         // burchak radiusi, px
uniform float u_roundness;      // superellipse darajasi
uniform float u_refThickness;
uniform float u_refDistance;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelHardness;
uniform float u_refFresnelFactor;
uniform float u_glareRange;
uniform float u_glareHardness;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_glareFactor;
uniform float u_glareAngle;
uniform float u_tint;           // shisha ichidagi rang (0 = oq)
uniform float u_opacity;        // shisha qatlami shaffofligi

float safeAsin(float x) { return asin(clamp(x, -1.0, 1.0)); }

float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

// lib/sdf.glsl: roundedRectSDF — markaz (0,0), burchak = superellipse
float shapeSDF(vec2 p) {
  float cr = min(u_radius, min(u_res.x, u_res.y) * 0.5);
  vec2 d = abs(p) - (u_res * 0.5);
  if (d.x > -cr && d.y > -cr) {
    vec2 cornerCenter = sign(p) * (u_res * 0.5 - cr);
    return superellipseCornerSDF(p - cornerCenter, cr, u_roundness);
  }
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec2 getNormal(vec2 p) {
  vec2 h = vec2(0.5);
  vec2 grad = vec2(
    shapeSDF(p + vec2(h.x, 0.0)) - shapeSDF(p - vec2(h.x, 0.0)),
    shapeSDF(p + vec2(0.0, h.y)) - shapeSDF(p - vec2(0.0, h.y))
  ) / (2.0 * h);
  return length(grad) > 0.00001 ? normalize(grad) : vec2(0.0, 1.0);
}

float edgeFactor(float merged) {
  if (merged >= 0.0) return 0.0;
  float nmerged = -merged;
  if (nmerged >= u_refThickness) return 0.0;
  float x_R_ratio = 1.0 - nmerged / u_refThickness;
  float thetaI = safeAsin(pow(x_R_ratio, 2.0));
  float thetaT = safeAsin(1.0 / u_refFactor * sin(thetaI));
  return max(0.0, -1.0 * tan(thetaT - thetaI));
}

vec4 dispersionSample(vec2 guv, vec2 offset, float mixRate) {
  float f = u_refDispersion;
  vec4 c;
  c.r = texture(u_bg, guv + offset * (1.0 + 0.02 * f)).r;
  c.g = texture(u_bg, guv + offset).g;
  c.b = texture(u_bg, guv + offset * (1.0 - 0.02 * f)).b;
  c.a = 1.0;
  vec4 b;
  b.r = texture(u_blurredBg, guv + offset * (1.0 + 0.02 * f)).r;
  b.g = texture(u_blurredBg, guv + offset).g;
  b.b = texture(u_blurredBg, guv + offset * (1.0 - 0.02 * f)).b;
  b.a = 1.0;
  return mix(c, b, mixRate);
}

void main() {
  vec2 p = (v_uv - 0.5) * u_res;
  float merged = shapeSDF(p);

  if (merged > 0.0) { fragColor = vec4(0.0); return; }

  // Tekstura = aynan shu element ortidagi hudud; lokal uv ishlatiladi.
  vec2 guv = vec2(v_uv.x, 1.0 - v_uv.y);

  float edge = edgeFactor(merged);
  vec2 normal = getNormal(p);
  vec4 outColor;

  if (edge <= 0.0) {
    outColor = texture(u_blurredBg, guv);
  } else {
    vec2 offset = -normal * edge * u_refDistance * 300.0;
    float nm = -merged;
    float edgeH = nm / max(u_refThickness, 0.001);       // shaderdagidek: chetda to'liq blur
    vec4 blurredPixel = dispersionSample(guv, offset / u_dpr, clamp(edgeH, 0.0, 1.0));
    outColor = mix(blurredPixel, vec4(u_tint), u_tint > 0.0 ? 0.12 : 0.0);

    float fresnelFactor = clamp(pow(
      max(0.0, 1.0 + merged / 1500.0 * pow(500.0 / max(u_refFresnelRange, 0.001), 2.0) + u_refFresnelHardness),
      5.0), 0.0, 1.0);
    outColor = mix(outColor, vec4(1.0), fresnelFactor * u_refFresnelFactor * 0.7);

    float glareGeoFactor = clamp(pow(
      max(0.0, 1.0 + merged / 1500.0 * pow(500.0 / max(u_glareRange, 0.001), 2.0) + u_glareHardness),
      5.0), 0.0, 1.0);

    float ang = atan(normal.y, normal.x);
    if (ang < 0.0) ang += 2.0 * PI;
    float glareAngle = (ang - PI / 4.0 + u_glareAngle) * 2.0;
    bool far = (glareAngle > PI * 1.5 && glareAngle < PI * 3.5) || glareAngle < -PI * 0.5;
    float glareAngleFactor = (0.5 + sin(glareAngle) * 0.5) *
      (far ? 1.2 * u_glareOppositeFactor : 1.2) * u_glareFactor;
    glareAngleFactor = clamp(pow(max(0.0, glareAngleFactor), 0.1 + u_glareConvergence * 2.0), 0.0, 1.0);

    outColor = mix(outColor, vec4(1.0), glareAngleFactor * glareGeoFactor);
  }

  float aa = clamp(0.5 - merged, 0.0, 1.0);
  fragColor = vec4(outColor.rgb, aa * u_opacity);
}`;