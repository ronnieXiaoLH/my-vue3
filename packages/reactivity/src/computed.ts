import { isFunction } from "@vue/shared"
import { effect, track, trigger } from "./effect"
import { TrackOpTypes, TriggerOrTypes } from "./operators"

class ComputedRefImpl {
  public _dirty = true
  public _value
  public effect
  constructor(getter, public setter) {
    this.effect = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true
          // 触发更新
          trigger(this, TriggerOrTypes.SET, 'value')
        }
      }
    })
  }

  get value() {
    // 如果是脏的需要重新取值，否则取缓存的值
    if (this._dirty) {
      this._value = this.effect()
      console.log('effect')
      this._dirty = false
    }
    // computed 也要进行依赖收集
    track(this, TrackOpTypes.GET, 'value')
    return this._value
  }

  set value(newValue) {
    this.setter(newValue)
  }
}

export function computed(getterOrOptions) {
  let getter, setter
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = () => {
      console.warn('computed value must be readonly')
    }
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return new ComputedRefImpl(getter, setter)
}