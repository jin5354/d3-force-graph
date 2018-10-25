attribute float scale;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = ${(3025 * window.devicePixelRatio).toFixed(2)} * scale / (cameraPosition.z - position.z);
  gl_Position = projectionMatrix * mvPosition;
}