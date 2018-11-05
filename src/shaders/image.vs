uniform float u_compensation;
uniform float scale;

void main() {
    vec3 distanceVector = cameraPosition - position;
    gl_PointSize = ${params.nodeSize} * u_compensation * scale / sqrt(dot(distanceVector, distanceVector));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
