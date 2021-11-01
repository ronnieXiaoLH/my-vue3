import { hasOwn } from "@vue/shared"

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    // 不允许访问以 $ 开头的属性
    if (key[0] === '$') return
    // 取值时，访问 setupState, props, data
    const { setupState, props, data } = instance
    if (hasOwn(setupState, key)) {
      return setupState[key]
    } else if (hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(props, key)) {
      return props[key]
    } else {
      return undefined
    }
  },
  set({ _: instance }, key, value) {
    const { setupState, props, data } = instance
    if (hasOwn(setupState, key)) {
      setupState[key] = value
    } else if (hasOwn(data, key)) {
      data[key] = value
    } else if (hasOwn(props, key)) {
      props[key] = value
    }
  }
}