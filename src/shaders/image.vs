void main() {
    gl_PointSize = ${(3025 * window.devicePixelRatio).toFixed(2)} * ${(info.scale || 1).toFixed(8) || '1.0'} / (cameraPosition.z - position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}