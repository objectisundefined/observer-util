const fs = require('fs')
const path = require('path')
const del = require('del')
// const buble = require('buble')
const rollup = require('rollup')
const resolvePlugin = require('rollup-plugin-node-resolve')
const babelPlugin = require('rollup-plugin-babel')
const externalsPlugin = require('rollup-plugin-auto-external')

const treeshake = {
  moduleSideEffects: false,
  propertyReadSideEffects: false,
  tryCatchDeoptimization: false
}

const input = {
  input: path.resolve('src/index.js'),
  plugins: [
    babelPlugin({
      exclude: 'node_modules/**'
    }),
    resolvePlugin(),
    externalsPlugin({ dependencies: true, peerDependecies: true })
  ],
  treeshake
}

// /*
const outputs = [
  // umd, name was used of global window[name] = { ... }
  {
    file: 'dist/observer-util.js',
    name: 'ObserverUtil',
    format: 'umd',
    sourcemap: true
  },
  { file: 'dist/observer-util.cjs.js', format: 'cjs', sourcemap: true },
  { file: 'dist/observer-util.esm.js', format: 'esm', sourcemap: true }
]

async function build () {
  // Clean up the output directory
  await del(path.resolve('dist'))
  fs.mkdirSync(path.resolve('dist'))

  const bundle = await rollup.rollup(input)

  for (const output of outputs) {
    // or write the bundle to disk
    await bundle.write(output)

    // similar like bottom
    // generate code and a sourcemap
    // const { output: [{ code, map }] } = await bundle.generate(output);

    // fs.writeFileSync(output.file, code, 'utf-8')
    // fs.writeFileSync(output.file + '.map', map, 'utf-8')
  }
}
// */

/*
const bundles = [
  { input, output: { format: 'es' } },
  { input, output: { format: 'cjs' } }
]

async function build () {
  // Clean up the output directory
  await del(path.resolve('dist'))
  fs.mkdirSync(path.resolve('dist'))

  // Compile source code into a distributable format with Babel and Rollup
  for (const config of bundles) {
    const es6Path = path.resolve('dist', `${config.output.format}.es6.js`)
    const bundle = await rollup.rollup(config.input)

    // evil [0]
    const {
      output: [{ code: es6Code }]
    } = await bundle.generate(config.output)

    fs.writeFileSync(es6Path, es6Code, 'utf-8')

    const es5Path = path.resolve('dist', `${config.output.format}.es5.js`)

    // can also use babel to transform

    // see https://buble.surge.sh/guide/
    const { code: es5Code } = buble.transform(es6Code, {
      // case: can't transform getters
      target: { chrome: 48, firefox: 44 },
      transforms: {
        dangerousForOf: true,
        modules: false
      }
    })

    fs.writeFileSync(es5Path, es5Code, 'utf-8')
  }
}
*/

build()
