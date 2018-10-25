void main() {
  gl_FragColor = vec4(1, 0, 0, 0.6);
  if(gl_FragColor.a < 0.5) discard;
}