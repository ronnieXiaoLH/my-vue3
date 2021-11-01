import { isArray, isObject, isString, ShapeFlags } from "@vue/shared"

export function createVNode(type, props, children = null) {
  const shapeFlag = isString(type) ? ShapeFlags.ELEMENT : isObject(type) ? ShapeFlags.STATEFUL_COMPONENT : 0
  const vnode = {
    __v_isVnode: true, // 标记是一个 vnode 节点
    type,
    props,
    children,
    Component: null, // 组件对应的实例
    el: null, // vnode 对应的真实 DOM
    key: props?.key,
    shapeFlag
  }
  normalizeChildren(vnode, children)
  return vnode
}

export function isVnode(vnode) {
  return vnode.__v_isVnode
}

function normalizeChildren(vnode, children) {
  let type = 0
  if (!children) {

  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else {
    type = ShapeFlags.TEXT_CHILDREN
  }
  // 用于后面判断 children 的类型
  vnode.shapeFlag = vnode.shapeFlag | type
}

export const Text = Symbol('text')

export const normalizeVnode = child => {
  if (isObject(child)) return child
  return createVNode(Text, null, String(child))
}
