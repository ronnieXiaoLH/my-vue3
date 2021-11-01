import path from 'path'
import json from '@rollup/plugin-json'
import ts from 'rollup-plugin-typescript2'
import resolvePlugin from '@rollup/plugin-node-resolve'

const packagesDir = path.resolve(__dirname, 'packages')

const name = process.env.TARGET
const packageDir = path.resolve(packagesDir, name)

const resolve = p => path.resolve(packageDir, p)

const pkg = require(resolve('package.json'))

const outputConfig = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: 'es'
  },
  'cjs': {
    file: resolve(`dist/${name}.cjs.js`),
    format: 'cjs'
  },
  'global': {
    file: resolve(`dist/${name}.global.js`),
    format: 'iife'
  }
}

const options = pkg.buildOptions

// 针对每一种打包的格式，都导出一份 rollup 的配置文件
// output 已经是一个对象，包含了 file 和 format
function createConfig (format, output) {
  output.name = options.name
  output.sourcemap = true
  // 生成 rollup 的配置
  return {
    input: resolve('src/index.ts'),
    output,
    plugins: [
      json(),
      ts({
        tsconfig: path.resolve(__dirname, 'tsconfig.json')
      }),
      resolvePlugin()
    ]
  }
}

export default options.formats.map(format => createConfig(format, outputConfig[format]))