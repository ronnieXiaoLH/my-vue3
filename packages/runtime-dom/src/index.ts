import {
  createRenderer,
  h,
  getCurrentInstance,
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted
} from "@vue/runtime-core";
import { extend } from "@vue/shared";
import { nodeOps } from "./nodeOps";
import { patchProp } from './patchProps'

// 渲染时用到的所有方法
const renderOptions = extend({ patchProp }, nodeOps)

export { renderOptions }

export function createApp(rootComponent, rootProps = null) {
  const app = createRenderer(renderOptions).createApp(rootComponent, rootProps)
  let { mount } = app
  // 重写 mount 方法，做一些其他的操作
  app.mount = (container) => {
    // 先清空容器的内容
    const el = nodeOps.querySelector(container)
    el.innerHTML = ''
    // 将组件渲染成的 DOM 元素，挂载到 el 上
    mount(el)
  }
  return app
}

export {
  h,
  getCurrentInstance,
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted
}