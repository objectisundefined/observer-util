const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

const distPath = path.resolve('dist')
const files = fs.readdirSync(distPath)

// es5 and es6 for original build output
const formats = ['cjs', 'esm', 'es5', 'es6']

async function testBuilds () {
  for (const file of files) {
    // case: umd bundle test failed
    if (!formats.some(format => file.match(RegExp(`\\.${format}\\.js$`)))) {
      continue
    }

    const err = await execPromise(`BUNDLE=${file} npm run test`)
    if (err) {
      console.error('\x1b[31m', `Error in ${file}`, '\x1b[30m')
    } else {
      console.log(`${file} works as expected`)
    }
  }
}

function execPromise (cmd) {
  return new Promise(resolve => exec(cmd, resolve))
}

testBuilds()
