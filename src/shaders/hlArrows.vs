attribute float rotate;
uniform float u_compensation;
varying float v_Rotate;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 distanceVector = cameraPosition - position;
    gl_PointSize = ${params.arrowSize} * u_compensation / sqrt(dot(distanceVector, distanceVector));
    gl_Position = projectionMatrix * mvPosition;
    v_Rotate = rotate;
}