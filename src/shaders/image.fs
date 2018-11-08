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
  float v_Rotate = 3.1415926535897932384626433832795;
  vec2 coord = gl_PointCoord;
  float sin_factor = sin(v_Rotate);
  float cos_factor = cos(v_Rotate);
  coord = (coord - 0.5) * mat2(cos_factor, sin_factor, -sin_factor, cos_factor);
  coord += 0.5;
  float distance = length(coord - vec2(0.5, 0.5));
  vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 white = vec4(1.0, 1.0, 1.0, 1.0);
  vec4 t_Color = texture2D(texture, coord);
  if(distance > 0.47) {
    gl_FragColor = mix(white, transparent, aastep(0.5, distance));
  }else {
    gl_FragColor = mix(t_Color, white, aastep(0.44, distance));
  }
  if(gl_FragColor.a == 0.0) discard;
}