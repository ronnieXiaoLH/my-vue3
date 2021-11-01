import { currentInstance, setCurrentInstance } from "./component"

const enum LifecycleHooks {
  BEFORE_MOUNT = 'bm',
  MONTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um'
}

const injectHook = (type, hook, target) => {
  if (!target) {
    return console.warn('injection APIs can only be used during execution of setup()')
  }
  const hooks = target[type] || (target[type] = [])
  // 子组件先 mounted ，父组件后 mounted ，为了保证 target 绑定的 hooks 是在自己的实例上
  const wrap = () => {
    setCurrentInstance(target) // 在给实例绑定 hooks 时，手动将 currentInstance 指向当前实例
    hook.call(target)
    setCurrentInstance(null)
  }
  hooks.push(wrap)
}

const createHook = (lifecycle) => (hook, target = currentInstance) => {
  injectHook(lifecycle, hook, target)
}

export const invokeArrayFns = fns => {
  for (let i = 0; i < fns.length; i++) {
    fns[i]()
  }
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MONTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)