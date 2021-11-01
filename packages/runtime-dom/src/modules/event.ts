export const patchEvent = (el, key, value) => {
  const invokers = el._vei || (el._vei = {})
  const exists = invokers[key]
  if (value && exists) {
    // 以前绑定过事件，现在也有，只是事件执行函数不一样
    exists.value = value
  } else {
    const eventName = key.slice(2).toLowerCase()
    if (value) {
      // 以前没有绑定过事件，要绑定
      let invoker = invokers[key] = createInvoker(value)
      el.addEventListener(eventName, invoker)
    } else {
      // 以前绑定过事件，现在没有了，要删除
      el.removeEventListener(eventName, exists)
      invokers[key] = undefined
    }
  }
}

// 使用这种方式，当修改了事件的执行函数，直接改value就行，而不是先删除已经绑定的事件函数，然后再绑定事件
function createInvoker(value) {
  const invoker = (e) => {
    invoker.value(e)
  }
  invoker.value = value
  return invoker
}