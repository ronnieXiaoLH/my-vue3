import { isObject } from "@vue/shared"
import { mutableHandlers, shallowReactiveHandlers, readonlyHandlers, shallowReadonlyHandlers } from './baseHandlers'

export function reactive(target) {
  return createReactiveObject(target, false, mutableHandlers)
}

export function shallowReactive(target) {
  return createReactiveObject(target, false, shallowReactiveHandlers)

}

export function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers)
}

export function shallowReadonly(target) {
  return createReactiveObject(target, true, shallowReadonlyHandlers)
}

const reactiveMap = new WeakMap()
const readonlyMap = new WeakMap()

function createReactiveObject(target, isReadonly, baseHandler) {
  if (!isObject(target)) return target

  const proxyMap = isReadonly ? readonlyMap : reactiveMap

  // 已经被代理了，直接返回代理
  if (proxyMap.has(target)) return proxyMap.get(target)

  const proxy = new Proxy(target, baseHandler)
  proxyMap.set(target, proxy)
  return proxy
}