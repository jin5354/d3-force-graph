attribute float scale;
uniform float u_compensation;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 distanceVector = cameraPosition - position;
  gl_PointSize = ${params.nodeSize} * u_compensation * scale / sqrt(dot(distanceVector, distanceVector));
  gl_Position = projectionMatrix * mvPosition;
}
