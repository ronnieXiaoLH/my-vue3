let queue = []

export function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlash()
  }
}

let isFlashPending = false
function queueFlash() {
  if (!isFlashPending) {
    isFlashPending = true
    Promise.resolve().then(flashJobs)
  }
}

function flashJobs() {
  isFlashPending = false
  // effect 排序
  queue.sort((a, b) => a.id - b.id)
  for (let i = 0; i < queue.length; i++) {
    queue[i]()
  }
  queue.length = 0
}