import { isArray, isObject } from "@vue/shared"
import { createVNode, isVnode } from "./vnode"

export function h(type, typeOrChildren, children?) {
  // console.log(type, typeOrChildren, children)
  const len = arguments.length
  // 类型 + 属性 || 类型 + children
  if (len === 2) {
    // 类型 + 属性
    if (isObject(typeOrChildren) && !isArray(typeOrChildren)) {
      if (isVnode(typeOrChildren)) {
        return createVNode(type, null, [typeOrChildren])
      } else {
        return createVNode(type, null, typeOrChildren)
      }
    } else {
      // 类型 + children
      return createVNode(type, null, typeOrChildren)
    }
  } else {
    if (len > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (len === 3 && isVnode(children)) {
      children = [children]
    }
    return createVNode(type, typeOrChildren, children)
  }
}