const path = require('path')
const CleanPlugin = require('clean-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: {
    'app': path.resolve(__dirname, '../src/index.ts')
  },
  output: {
    libraryTarget: 'umd',
    library: 'D3ForceGraph',
    filename: 'd3-force-graph.js',
    path: path.resolve(__dirname, '../dist'),
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.(ts(x?)|js(x?))$/,
        exclude: /node_modules/,
        use: [
            'babel-loader',
            'ts-loader'
        ]
      },
      {
        test: /\.(vs|fs)$/,
        use: 'raw-loader'
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