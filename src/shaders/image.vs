uniform float u_compensation;
uniform float scale;

void main() {
    vec3 distanceVector = cameraPosition - position;
    gl_PointSize = 3025.0 * u_compensation * scale / sqrt(dot(distanceVector, distanceVector));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
