// 把 packages 目录下的某个包都进行打包

const fs = require('fs')
const execa = require('execa')

const target = 'compiler-dom'

async function build (target) {
  // 开启子进程打包
  await execa('rollup', ['-cw', '--environment', `TARGET:${target}`], { stdio: 'inherit' }) // 子进程的打包信息共享给父进程
}

build(target)