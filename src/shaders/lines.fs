varying vec3 v_Color;

void main() {
  gl_FragColor = vec4(v_Color.x, v_Color.y, v_Color.z, 0.6);
}