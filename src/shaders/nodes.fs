uniform sampler2D texture;

float aastep(float threshold, float value) {
#ifdef GL_OES_standard_derivatives
  float afwidth = 1.0 * fwidth(value);
#else
  float afwidth = 0.05;
#endif
  return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

void main() {
  vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 t_Color = texture2D(texture, gl_PointCoord);
  float distance = length(gl_PointCoord - vec2(0.5, 0.5));
  gl_FragColor = mix(t_Color, transparent, aastep(0.5, distance));
  if(gl_FragColor.a == 0.0) discard;
}