// 把 packages 目录下的所有包都进行打包

const fs = require('fs')
const execa = require('execa')

// 找到 packages 目录下的所有文件夹
const targets = fs.readdirSync('packages').filter(f => fs.statSync(`packages/${f}`).isDirectory())

async function build (target) {
  // 开启子进程打包
  await execa('rollup', ['-c', '--environment', `TARGET:${target}`], { stdio: 'inherit' }) // 子进程的打包信息共享给父进程
}

function runParallel (targets, iteratorFn) {
  const res = []
  for (const item of targets) {
    const p = iteratorFn(item)
    res.push(p)
  }
  return Promise.all(res)
}

// 对目标目录进行依次打包，并行打包
runParallel(targets, build)