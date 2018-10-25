uniform sampler2D texture;

void main() {
  float v_Rotate = 3.1415926535897932384626433832795;
  vec2 coord = gl_PointCoord;
  float sin_factor = sin(v_Rotate);
  float cos_factor = cos(v_Rotate);
  coord = (coord - 0.5) * mat2(cos_factor, sin_factor, -sin_factor, cos_factor);
  coord += 0.5;
  gl_FragColor = texture2D(texture, coord);
  if(gl_FragColor.a < 0.5) discard;
}