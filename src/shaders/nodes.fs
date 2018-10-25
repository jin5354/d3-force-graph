uniform sampler2D texture;

void main() {
  gl_FragColor = texture2D(texture, gl_PointCoord);
  if(gl_FragColor.a < 0.5) discard;
}