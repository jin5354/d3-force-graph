uniform float u_compensation;
uniform float scale;

void main() {
    gl_PointSize = 3025.0 * u_compensation * scale / (cameraPosition.z - position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
