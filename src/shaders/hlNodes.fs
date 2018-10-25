uniform sampler2D texture;

void main() {
    gl_FragColor = texture2D(texture, gl_PointCoord) * vec4(1, 0, 0, 0.6);
}