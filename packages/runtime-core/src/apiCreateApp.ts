import { createVNode } from "./vnode"

export function createAppAPI(render) {
  return function createApp(rootComponent, rootProps) { // 告诉 core 用哪个组件和属性来创建应用
    const app = {
      _props: rootProps,
      _component: rootComponent,
      _container: null,
      // 告诉 core 创建的应用挂载到哪里
      mount(container) {
        // 1. 根据组件创建虚拟节点vnode
        const vnode = createVNode(rootComponent, rootProps)
        // console.log(vnode)
        // 2. 调用 render 方法进行渲染
        render(vnode, container)

        app._container = container
      }
    }
    return app
  }
}