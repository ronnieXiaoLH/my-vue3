import { extend, hasChanged, hasOwn, isArray, isIntegerKey, isObject } from "@vue/shared"
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOrTypes } from "./operators"
import { reactive, readonly } from "./reactive"

function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver)
    if (!isReadonly) {
      // 收集依赖，数据变化后更新视图
      track(target, TrackOpTypes.GET, key)
    }
    if (isShallow) {
      return res
    }
    // Vue3是懒代理，取值的时候才会去代理深层对象(Vue2是直接深度递归代理)
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}

const get = createGetter()
const shallowReactiveGet = createGetter(false, true)
const readonlyGet = createGetter(true, false)
const shallowReadonlyGet = createGetter(true, true)

function createSetter(isShallow = false) {
  return function set(target, key, value, receiver) {
    const oldValue = target[key] // 获取旧的值

    // 如果是数组，判断修改的索引是否小于数组的长度
    // 如果是对象，判断对象是否之前就有该属性
    const hasKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key)

    const result = Reflect.set(target, key, value, receiver)


    // 当数据更新时，通知对应属性的effect执行
    if (!hasKey) {
      // 新增的属性
      trigger(target, TriggerOrTypes.ADD, key, value)
    } else if (hasChanged(oldValue, value)) {
      // 修改属性的值
      trigger(target, TriggerOrTypes.SET, key, value, oldValue)
    }

    return result
  }
}

const set = createSetter()
const shallowReactiveSet = createSetter(true)

const readonlyObj = {
  set: (target, key) => {
    console.warn(`cannot set key ${key} is readonly`)
  }
}

export const mutableHandlers = {
  get,
  set
}
export const shallowReactiveHandlers = {
  get: shallowReactiveGet,
  set: shallowReactiveSet
}
export const readonlyHandlers = extend({
  get: readonlyGet,
  ...readonlyObj
})
export const shallowReadonlyHandlers = extend({
  get: shallowReadonlyGet,
  ...readonlyObj
})