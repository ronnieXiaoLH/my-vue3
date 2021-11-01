import { isArray, isIntegerKey } from "@vue/shared"
import { TriggerOrTypes } from "./operators"

export function effect(fn, options: any = {}) {
  // 
  const effect = createReactiveEffect(fn, options)

  if (!options.lazy) {
    effect() // 默认会执行一次
  }

  return effect
}

let uid = 0
let activeEffect
let effectStack = []
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    if (effectStack.includes(effect)) return
    // 这里之所以使用 try 是因为 fn 执行的过程可能报错，但是无论是否报错，我们都要重新维护 effectStack 和 activeEffect
    try {
      effectStack.push(effect)
      activeEffect = effect
      console.log('activeEffect', activeEffect)
      return fn()
    } finally {
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1]
    }
  }

  effect.id = uid++ // 每一个 effect 都有一个唯一的标识
  effect._isEffect = true // 标识是响应式的 effect
  effect.raw = fn // 记录 effect 的原始函数
  effect.options = options

  return effect
}

// 将 activeEffect 与 target[key] 关联起来，当 target[key] 值改变时，执行activeEffect
const targetMap = new WeakMap
export function track(target, type, key) {
  console.log(target, type, key, activeEffect)
  if (activeEffect === undefined) return
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map)
  }
  let depsMap = targetMap.get(target)
  if (!depsMap.has(key)) {
    depsMap.set(key, new Set)
  }
  let dep = depsMap.get(key)
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
  }
  // console.log(targetMap)
}

// 根据已经关联的 activeEffect 与 target[key]，执行对应的 activeEffect 来更新视图
// activeEffect 存储的就是更新视图的操作
export function trigger(target, type, key, newValue?, oldValue?) {
  console.log(target, type, key, newValue, oldValue, targetMap)
  if (!targetMap.has(target)) return
  const depsMap = targetMap.get(target)
  // console.log('depsMap', depsMap)
  const effects = new Set // 可以去重 effect
  const add = effectsAdd => {
    if (effectsAdd) {
      effectsAdd.forEach(effect => effects.add(effect))
    }
  }
  // 如果修改的是数组的length
  if (isArray(target) && key === 'length') {
    depsMap.forEach((dep, k) => {
      if (k === 'length' || k >= newValue) {
        add(dep)
      }
    })
  } else {
    // 如果是对象
    if (key !== undefined) {
      add(depsMap.get(key))
    }
    // 如果修改的是数组的某个索引，那就把数组长度的effect收集起来
    switch (type) {
      case TriggerOrTypes.ADD:
        if (isArray(target) && isIntegerKey(key)) {
          add(depsMap.get('length'))
        }
    }
  }

  // console.log(effects)
  effects.forEach((effect: any) => {
    // computed 里面访问的数据，这个数据在收集依赖的时候因为 computed 里访问了它，所以 computed 也会被该数据收集
    // 当 computed 里依赖的数据发生改变了，它会执行它收集的 effect 的，这个时候 computed effect 也被执行了，所以 scheduler 执行了，computed effect 的 _dirty 置为 false 了
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  })
}