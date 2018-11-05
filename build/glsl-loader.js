module.exports = function glslLoader(source) {
  this.value = source

  const json = JSON.stringify(source)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/^"|"$/g, '`')

  return `module.exports = function(params) {
    return ${json}
  }`;
}