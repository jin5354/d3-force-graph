attribute vec3 color;
varying vec3 v_Color;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  v_Color = color;
}