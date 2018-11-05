const path = require('path')
const CleanPlugin = require('clean-webpack-plugin')
const fs = require('fs')

module.exports = {
  mode: 'production',
  entry: {
    'app': path.resolve(__dirname, '../src/index.ts')
  },
  output: {
    libraryTarget: 'umd',
    filename: 'd3-force-graph.js',
    path: path.resolve(__dirname, '../dist'),
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.(ts(x?)|js(x?))$/,
        exclude: /(node_modules|worker\.js)/,
        use: [
          'babel-loader',
          'ts-loader'
        ]
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.(vs|fs)$/,
        use: [
          {
            loader: path.join(__dirname, './glsl-loader.js')
          }
        ]
      },
      {
        test: /worker\.js$/,
        exclude: /node_modules/,
        use: [
          'raw-loader',
          {
            loader: 'string-replace-loader',
            options: {
              multiple: [
                {
                  search: `importScripts('d3-collection/dist/d3-collection.min.js')`,
                  replace: fs.readFileSync(path.join(__dirname, '../node_modules/d3-collection/dist/d3-collection.min.js'), 'utf8')
                },
                {
                  search: `importScripts('d3-dispatch/dist/d3-dispatch.min.js')`,
                  replace: fs.readFileSync(path.join(__dirname, '../node_modules/d3-dispatch/dist/d3-dispatch.min.js'), 'utf8')
                },
                {
                  search: `importScripts('d3-quadtree/dist/d3-quadtree.min.js')`,
                  replace: fs.readFileSync(path.join(__dirname, '../node_modules/d3-quadtree/dist/d3-quadtree.min.js'), 'utf8')
                },
                {
                  search: `importScripts('d3-timer/dist/d3-timer.min.js')`,
                  replace: fs.readFileSync(path.join(__dirname, '../node_modules/d3-timer/dist/d3-timer.min.js'), 'utf8')
                },
                {
                  search: `importScripts('d3-force/dist/d3-force.min.js')`,
                  replace: fs.readFileSync(path.join(__dirname, '../node_modules/d3-force/dist/d3-force.min.js'), 'utf8')
                }
              ]
            }
          }
        ]
      },
      {
        test: /\.(png|jpg|gif|eot|svg|ttf|woff|woff2)(\?\S*)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 8192
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },
  plugins: [
    new CleanPlugin(['dist'], {
      root: path.resolve(__dirname, '../'),
    })
  ]
}