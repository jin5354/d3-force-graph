attribute float scale;
uniform float u_compensation;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 3000.0 * u_compensation * scale / (cameraPosition.z - position.z);
  gl_Position = projectionMatrix * mvPosition;
}
