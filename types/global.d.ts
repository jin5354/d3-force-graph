interface Window {
  THREE: any
}

declare var window: Window

// https://github.com/webpack-contrib/raw-loader/issues/54
declare module '*.vs' {
  const content: string
  export = content
}
declare module '*.fs' {
  const content: string
  export = content
}
declare module '*worker.js' {
  const content: string
  export = content
}
declare module '*.png' {
  const content: string
  export = content
}
