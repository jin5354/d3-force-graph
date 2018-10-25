uniform sampler2D texture;
varying float v_Rotate;

void main() {
  vec2 coord = gl_PointCoord;
  float sin_factor = sin(v_Rotate);
  float cos_factor = cos(v_Rotate);
  coord = (coord - 0.5) * mat2(cos_factor, sin_factor, -sin_factor, cos_factor);
  coord += 0.5;
  gl_FragColor = texture2D(texture, coord) * vec4(1, 1, 1, 0.9);
}