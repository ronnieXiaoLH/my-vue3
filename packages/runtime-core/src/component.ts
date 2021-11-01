import { isFunction, isObject, ShapeFlags } from "@vue/shared"
import { PublicInstanceProxyHandlers } from "./componentPublicInstance"

export function createComponentInstance(vnode) {
  const instance = {
    vnode,
    type: vnode.type,
    props: {},
    attrs: {},
    slots: {},
    ctx: {},
    data: {},
    setupState: {}, // setup 的返回值
    render: null,
    isMounted: false // 表示组件是否已经挂载过
  }
  instance.ctx = { _: instance }
  return instance
}

export function setupComonent(instance) {
  const { props, children, shapeFlag } = instance.vnode
  instance.props = props
  instance.children = children

  const isStateful = shapeFlag & ShapeFlags.STATEFUL_COMPONENT
  // 带状态的组件
  if (isStateful) {
    setupStatefulComponent(instance)
  }
}

export let currentInstance = null

export const setCurrentInstance = instance => {
  currentInstance = instance
}

export const getCurrentInstance = () => currentInstance

function setupStatefulComponent(instance) {
  // 1. 代理，在应用的时候，可以在 render 的第一参数里直接拿到所有的数据
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers as any)
  // 2. 执行组件的 setup 方法
  const Component = instance.type
  const { setup } = Component
  if (setup) {
    currentInstance = instance
    const setupContext = createSetupContext(instance)
    const setupResult = setup(instance.props, setupContext)
    currentInstance = null
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance)
  }
}

function handleSetupResult(instance, setupResult) {
  // setup 里返回的 render 的优先级高于 render
  if (isFunction(setupResult)) {
    instance.render = setupResult
  } else if (isObject(setupResult)) {
    instance.setupState = setupResult
  }
  finishComponentSetup(instance)
}

function finishComponentSetup(instance) {
  const Component = instance.type
  if (!instance.render) {
    // 对 template 模板进行编译，生成 render 函数
    if (!Component.render && Component.template) {
      // Component.render = render
    }
    instance.render = Component.render
  }
}

function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    // props: instance.props,
    slots: instance.slots,
    emit: () => { },
    expose: () => { }
  }
}