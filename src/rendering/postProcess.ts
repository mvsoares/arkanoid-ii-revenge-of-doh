import type { DipSwitchSettings } from '../types';

const VERT_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
out vec2 vUv;

void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uChroma;
uniform int uPreset;      // 0 = hd_neon, 1 = crt_1987
uniform float uCurvature; // 0.0 or 1.0

vec2 curveUv(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  vec2 offset = abs(c.yx) / vec2(6.5, 5.5);
  c = c + c * offset * offset;
  return c * 0.5 + 0.5;
}

vec3 sampleBright(vec2 uv) {
  vec3 col = texture(uTex, clamp(uv, 0.001, 0.999)).rgb;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  float mask = smoothstep(0.58, 0.95, luma);
  return col * mask;
}

void main() {
  vec2 uv = vUv;

  if (uPreset == 1 && uCurvature > 0.5) {
    uv = curveUv(uv);
  }

  // Bezel / out-of-bounds mask for curved CRT
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.015, 0.018, 0.028, 1.0);
    return;
  }

  vec2 texel = 1.0 / uResolution;
  vec2 centerOffset = uv - 0.5;
  float dist2 = dot(centerOffset, centerOffset);

  // Chromatic aberration
  float baseShift = (uPreset == 1) ? 0.0014 : 0.0;
  float pulseShift = uChroma * 0.009 * (0.4 + dist2 * 1.6);
  vec2 chromaDir = normalize(centerOffset + vec2(0.0001)) * (baseShift + pulseShift);

  vec3 baseCol;
  if (baseShift + pulseShift > 0.0001) {
    baseCol.r = texture(uTex, clamp(uv + chromaDir, 0.001, 0.999)).r;
    baseCol.g = texture(uTex, uv).g;
    baseCol.b = texture(uTex, clamp(uv - chromaDir, 0.001, 0.999)).b;
  } else {
    baseCol = texture(uTex, uv).rgb;
  }

  // Multi-tap bright-pass bloom
  vec3 bloom = vec3(0.0);
  float spread = (uPreset == 1) ? 2.4 : 3.2;
  bloom += sampleBright(uv + vec2( spread,  0.0) * texel);
  bloom += sampleBright(uv + vec2(-spread,  0.0) * texel);
  bloom += sampleBright(uv + vec2( 0.0,  spread) * texel);
  bloom += sampleBright(uv + vec2( 0.0, -spread) * texel);
  float diag = spread * 0.72;
  bloom += sampleBright(uv + vec2( diag,  diag) * texel);
  bloom += sampleBright(uv + vec2(-diag,  diag) * texel);
  bloom += sampleBright(uv + vec2( diag, -diag) * texel);
  bloom += sampleBright(uv + vec2(-diag, -diag) * texel);
  float wide = spread * 2.1;
  bloom += sampleBright(uv + vec2( wide,  0.0) * texel) * 0.6;
  bloom += sampleBright(uv + vec2(-wide,  0.0) * texel) * 0.6;
  bloom += sampleBright(uv + vec2( 0.0,  wide) * texel) * 0.6;
  bloom += sampleBright(uv + vec2( 0.0, -wide) * texel) * 0.6;
  bloom /= 10.4;

  vec3 color = baseCol;

  if (uPreset == 1) {
    // 1987 Trinitron Arcade CRT Simulation
    color += bloom * 0.58;

    // Horizontal scanlines
    float scanWave = sin(uv.y * uResolution.y * 3.14159265 * 1.0);
    float scanline = 0.84 + 0.16 * scanWave;
    color *= scanline;

    // Subtle Trinitron aperture grille RGB phosphor mask
    float px = floor(uv.x * uResolution.x);
    float sub = mod(px, 3.0);
    vec3 grille = vec3(
      sub < 1.0 ? 1.08 : 0.92,
      (sub >= 1.0 && sub < 2.0) ? 1.08 : 0.92,
      sub >= 2.0 ? 1.08 : 0.92
    );
    color *= grille;

    // Subtle analog flicker & warm phosphor lift
    float flicker = 0.985 + 0.015 * sin(uTime * 42.0);
    color *= flicker;
    color = pow(max(color, vec3(0.0)), vec3(0.95));

    // Curved corner bezel shadow + vignette
    float vig = 1.0 - dist2 * 0.62;
    if (uCurvature > 0.5) {
      vec2 edge = min(uv, 1.0 - uv);
      float border = smoothstep(0.0, 0.016, min(edge.x, edge.y));
      vig *= border;
    }
    color *= clamp(vig, 0.0, 1.0);
  } else {
    // HD Neon Cyber Remaster
    color += bloom * 0.72;
    float vig = 1.0 - dist2 * 0.28;
    color *= clamp(vig, 0.72, 1.0);
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class PostProcessor {
  private sourceCanvas: HTMLCanvasElement;
  private glCanvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;

  private uTexLoc: WebGLUniformLocation | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uChromaLoc: WebGLUniformLocation | null = null;
  private uPresetLoc: WebGLUniformLocation | null = null;
  private uCurvatureLoc: WebGLUniformLocation | null = null;

  constructor(sourceCanvas: HTMLCanvasElement, glCanvas: HTMLCanvasElement) {
    this.sourceCanvas = sourceCanvas;
    this.glCanvas = glCanvas;
    this.init();
  }

  private init(): void {
    try {
      const gl = this.glCanvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) {
        this.glCanvas.style.display = 'none';
        return;
      }

      const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        this.glCanvas.style.display = 'none';
        return;
      }

      const program = gl.createProgram();
      if (!program) {
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.glCanvas.style.display = 'none';
        return;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        this.glCanvas.style.display = 'none';
        return;
      }

      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      const texture = gl.createTexture();
      if (!vao || !vbo || !texture) {
        gl.deleteProgram(program);
        this.glCanvas.style.display = 'none';
        return;
      }

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, null);

      this.gl = gl;
      this.program = program;
      this.vao = vao;
      this.vbo = vbo;
      this.texture = texture;

      this.uTexLoc = gl.getUniformLocation(program, 'uTex');
      this.uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
      this.uTimeLoc = gl.getUniformLocation(program, 'uTime');
      this.uChromaLoc = gl.getUniformLocation(program, 'uChroma');
      this.uPresetLoc = gl.getUniformLocation(program, 'uPreset');
      this.uCurvatureLoc = gl.getUniformLocation(program, 'uCurvature');
    } catch {
      this.gl = null;
      this.glCanvas.style.display = 'none';
    }
  }

  public render(settings: DipSwitchSettings, time: number, chromaPulse: number): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao || !this.texture) {
      return;
    }

    const w = this.sourceCanvas.width;
    const h = this.sourceCanvas.height;
    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.glCanvas.width = w;
      this.glCanvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);

    if (this.uTexLoc) gl.uniform1i(this.uTexLoc, 0);
    if (this.uResolutionLoc) gl.uniform2f(this.uResolutionLoc, w, h);
    if (this.uTimeLoc) gl.uniform1f(this.uTimeLoc, time);
    if (this.uChromaLoc) gl.uniform1f(this.uChromaLoc, chromaPulse);
    if (this.uPresetLoc) gl.uniform1i(this.uPresetLoc, settings.visualPreset === 'crt_1987' ? 1 : 0);
    if (this.uCurvatureLoc) gl.uniform1f(this.uCurvatureLoc, settings.crtCurvature ? 1.0 : 0.0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  public dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
    this.vao = null;
    this.vbo = null;
    this.texture = null;
  }
}
