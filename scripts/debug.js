// const fs = require('fs')
const path = require('path')
const rollup = require('rollup')
const resolvePlugin = require('rollup-plugin-node-resolve')
const babelPlugin = require('rollup-plugin-babel')
const alias = require('@rollup/plugin-alias')

const bundleType = process.env.BUNDLE
const bundlePath = bundleType ? `dist/${bundleType}.js` : 'src/index.js'

const config = {
  input: {
    input: path.resolve('debug/index.js'),
    plugins: [
      babelPlugin({
        exclude: 'node_modules/**'
      }),
      resolvePlugin(),
      // see https://github.com/rollup/plugins/tree/master/packages/alias
      alias({
        // '@nx-js/observer-util': path.resolve(bundlePath)
        entries: [
          {
            find: '@nx-js/observer-util',
            replacement: path.resolve(bundlePath)
          }
        ]
      })
    ]
  },
  output: {
    file: path.resolve('debug', 'dist.js'),
    format: 'iife'
  }
}

async function build () {
  // Compile source code into a distributable format with Babel and Rollup
  const bundle = await rollup.rollup(config.input)

  await bundle.write(config.output)

  // const { code } = await bundle.generate(config.output)
  // const bundlePath = path.resolve('debug', 'dist.js')
  // fs.writeFileSync(bundlePath, code, 'utf-8')
}

build()
