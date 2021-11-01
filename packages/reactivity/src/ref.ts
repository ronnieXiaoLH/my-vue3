import { hasChanged, isArray, isObject } from "@vue/shared"
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOrTypes } from "./operators"
import { reactive } from "./reactive"

export function ref(value) {
  return createRef(value)
}

export function shallowRef(value) {
  return createRef(value, true)
}

const convert = val => isObject(val) ? reactive(val) : val

class RefImpl {
  public _value // 表示声明了一个 _value 属性，但是没有赋值
  public __v_isRef = true // 产生的实例会被添加 __v_isRef 属性，表示是一个 ref 属性
  constructor(public _rawValue, public _shallow) {
    // 如果 _shallow 为 true，
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }

  // 类的属性访问器
  get value() {
    track(this, TrackOpTypes.GET, 'value')
    return this._value
  }

  set value(newValue) {
    if (hasChanged(newValue, this._rawValue)) {
      this._rawValue = newValue
      this._value = this._shallow ? newValue : convert(newValue)
      trigger(this, TriggerOrTypes.SET, 'value', newValue)
    }
  }
}

function createRef(_rawValue, _shallow = false) {
  return new RefImpl(_rawValue, _shallow)
}

class ObjectRefImpl {
  public __v_isRef = true
  constructor(public _object, public _key) {
  }

  // 这里只是代理，如果原对象是响应式的数据，就会进行依赖收集
  get value() {
    return this._object[this._key]
  }

  // 同样，如果原对象是响应书的数据，就会触发更新
  set value(newValue) {
    if (hasChanged(newValue, this.value)) {
      this._object[this._key] = newValue
    }
  }
}

// toRef 和 toRefs 作用是使从响应式对象中结构出来的数据也是响应式的
export function toRef(target, key) {
  return new ObjectRefImpl(target, key)
}

export function toRefs(target) {
  const res = isArray(target) ? Array(target.length) : {}
  for (let key in target) {
    res[key] = toRef(target, key)
  }
  return res
}