const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const Externals = require('webpack-node-externals')

const onEnvironment = (production, development) =>
  process.env.NODE_ENV === 'production'
    ? JSON.stringify(production)
    : JSON.stringify(development)

module.exports = {
  devtool: 'source-map',
  entry: './src/index',
  mode: process.env.NODE_ENV,
  target: 'node',
  node: {
    global: false,
    __filename: false,
    __dirname: false
  },
  externals: [Externals()],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  resolve: {
    mainFields: ['main', 'module'],
    extensions: ['.ts', '.tsx', '.js', '.json', '.jpe', '.jpeg', '.png', '.gif', '.svg', '.ttf', '.otf']
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      include: path.join(__dirname, 'src'),
      use: [{
        loader: 'ts-loader'
      }]
    }, {
      test: /\.(jpe?g|png|gif|svg|ttf|otf)$/,
      include: path.join(__dirname, 'src'),
      use: [{
        loader: 'file-loader',
        options: {
          hash: 'sha512',
          digest: 'hex',
          name: (file) => process.env.NODE_ENV === 'production'? '[hash].[ext]':'[path][name].[ext]'
        }  
      }]
    }]
  },
  devServer: {
    host: '0.0.0.0'
  },
  plugins: [
    new webpack.DefinePlugin({
      'ENV': JSON.stringify(process.env.NODE_ENV),
      'PORT': JSON.stringify(process.env.PORT),
      'HOST': JSON.stringify(''),
      'NEO4J_HOST': JSON.stringify(''),
      'NEO4J_USER': JSON.stringify({user:'', password:''}),
      'SPACES_CREDENTIAL': JSON.stringify({
        accessKeyId: '',
        secretAccessKey: ''
      }),
      'SPACES_URL': JSON.stringify(''),
      'BILLPLZ_HOST': JSON.stringify(''),
      'BILLPLZ_SECRETS': JSON.stringify({
        collection: '',
        key: '',
        signature: ''
      }),
      'DISCORD_TOKEN': JSON.stringify(''),
      'DISCORD_SETTING': onEnvironment({
        prefix: '',
        server: ''
      }, {
        prefix: '',
        server: ''
      }),
      'SENDGRID_KEY': JSON.stringify('')
    }),
    new CopyPlugin({
      patterns: [
        {from:'src/asset/public/*', to:'public/[name][ext]'}
      ]
    })
  ]
}