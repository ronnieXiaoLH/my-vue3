import { effect } from "@vue/reactivity"
import { ShapeFlags } from "@vue/shared"
import { patchProp } from "packages/runtime-dom/src/patchProps"
import { createAppAPI } from "./apiCreateApp"
import { invokeArrayFns } from "./apiLifecycle"
import { createComponentInstance, setupComonent } from "./component"
import { queueJob } from "./scheduler"
import { normalizeVnode, Text } from "./vnode"

export function createRenderer(renderOptions) { // 告诉 core 怎么渲染
  const {
    createElement: hostCreateElement,
    remove: hostRemove,
    insert: hostInsert,
    setElementText: hostSetElementText,
    patchProp: hostPatchProp,
    createText: hostCreateText,
    setText: hostSetText,
    nextSibling: hostNextSibling
  } = renderOptions
  const setupRenderEffect = (instance, container) => {
    const componentEffect = () => {
      console.log('effect run')
      if (!instance.isMounted) {
        // 组件初次渲染
        const { bm, m } = instance
        if (bm) {
          invokeArrayFns(bm)
        }
        const subTree = instance.subTree = instance.render.call(instance.proxy, instance.proxy)
        // console.log('subTree', subTree)
        patch(null, subTree, container)
        instance.isMounted = true
        if (m) {
          invokeArrayFns(m)
        }
      } else {
        // 组件更新渲染 diff 算法
        console.log('组件更新')
        const { bu, u } = instance
        if (bu) {
          invokeArrayFns(bu)
        }
        const prevTree = instance.subTree
        const nextTree = instance.render.call(instance.proxy, instance.proxy)
        patch(prevTree, nextTree, container)
        if (u) {
          invokeArrayFns(u)
        }
      }
    }
    instance.update = effect(componentEffect, {
      scheduler: queueJob
    })
  }

  const mountComponent = (n2, container) => {
    // 1. 创建组件实例
    const instance = n2.component = createComponentInstance(n2)
    // 2. 将需要的数据挂载到实例上
    setupComonent(instance)
    // 3. 创建一个 effect，让 render 函数执行
    setupRenderEffect(instance, container)
  }

  const processComponent = (n1, n2, container) => {
    if (!n1) {
      // 组件挂载
      mountComponent(n2, container)
    } else {
      // 组件更新
    }
  }

  const mountChildren = (chilren, container) => {
    for (let i = 0; i < chilren.length; i++) {
      let child = normalizeVnode(chilren[i]) // 处理多个 children 内容都是文本的情况
      patch(null, child, container)
    }
  }

  const mountElement = (n2, container, anchor = null) => {
    const { type, props, shapeFlag, children } = n2
    // console.log(type, props, shapeFlag, children)
    let el = n2.el = hostCreateElement(type)
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el)
    }
    hostInsert(el, container, anchor)
  }

  const patchProps = (el, oldProps, newProps) => {
    for (const key in newProps) {
      patchProp(el, key, oldProps[key], newProps[key])
    }
    for (const key in oldProps) {
      if (newProps[key]) continue
      patchProp(el, key, oldProps[key], null)
    }
  }

  const patchElement = (n1, n2, container) => {
    // n1 和 n2 是相同的元素
    let el = n2.el = n1.el // 复用旧的元素
    // 更新元素的属性，比对更新儿子
    const oldProps = n1.props || {}
    const newProps = n2.props || {}
    patchProps(el, oldProps, newProps)
    patchChildren(n1, n2, container)
  }

  const unmounChildren = children => {
    for (let i = 0; i < children.length; i++) {
      unmout(children[i])
    }
  }

  const patchKeyedChildren = (c1, c2, el) => {
    let i = 0
    let e1 = c1.length - 1
    let e2 = c2.length - 1
    // sync from start 从头开始比对，遇到不是相同的节点就停止
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = c2[i]
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el)
      } else {
        break
      }
    }
    // sync from end 从尾开始比对，遇到不是相同的节点就停止
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el)
      } else {
        break
      }
      e1--
      e2--
    }
    // 新的节点多，要新增
    if (i > e1) {
      // 要新增的是 i ~ e2 之间的节点
      if (i <= e2) {
        const nextPos = e2 + 1
        // nextPos >= c2.length 表示在 c2 的尾部新增，否则表示不是在 c2 的尾部新增，需要插入新增节点的 anchor
        const anchor = nextPos >= c2.length ? null : c2[nextPos].el
        while (i <= e2) {
          patch(null, c2[i], el, anchor)
          i++
        }
      }
    } else if (i > e2) {
      // 新的节点少，删除c1 i ~ e2 之间的子节点
      while (i <= e2) {
        unmout(c1[i++])
      }
    } else {
      // 乱序比对
      // Vue3 是用的节点做映射表，Vue2 是用老的节点做映射表
      let s1 = i, s2 = i
      const keyToNewIndexMap = new Map()
      for (let i = s2; i < e2; i++) {
        const childVnode = c2[i]
        keyToNewIndexMap.set(childVnode.key, i)
      }
      const toBePatched = e2 - s2 + 1
      // newIndexToOldIndexMap 用来记录映射表的哪些节点被复用了，不为 0 表示已被复用了
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0)
      // 遍历老的节点，在映射表里查找能复用的节点
      for (let i = s1; i < e1; i++) {
        const oldVnode = c1[i]
        let newIndex = keyToNewIndexMap.get(oldVnode.key)
        // 老的节点在映射表中没有找到，删除老节点
        if (!newIndex) {
          unmout(oldVnode)
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          // 这里调用 patch 使 c2[newIndex] 复用了旧的子节点的 el
          patch(oldVnode, c2[newIndex], el)
        }
      }
      // 上面在映射表中找的节点的位置还是用的老节点的位置，还需要更新上面在映射表中找的节点的位置，同时还需要新增上面映射表中没有用到的节点
      const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap)
      let j = increasingNewIndexSequence.length - 1
      for (let i = toBePatched - 1; i >= 0; i--) {
        let currentIndex = i + s2
        let childVnode = c2[currentIndex]
        let anchor = currentIndex + 1 >= c2.length ? null : c2[currentIndex + 1].el
        // 映射表中没有被复用的节点，新增
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, childVnode, el, anchor)
        } else {
          // 映射表中已经被复用的节点，此时该节点的 el 已经有了，复用了旧的子节点
          // 这里使用这种方式，把所有的新节点都插入了一遍，性能还有优化空间，所以引出了 最长递增子序列
          // hostInsert(childVnode.el, el, anchor)
          // 是最长递增子序列里包含的节点不需要插入
          if (i !== increasingNewIndexSequence[j]) {
            hostInsert(childVnode.el, el, anchor)
          } else {
            // 跳过不需要移动的元素
            j--
          }
        }
      }
    }
  }

  const getSequence = (arr) => {
    const len = arr.length
    const result = [0]
    const p = arr.slice()
    let start, end, middle
    for (let i = 1; i < len; i++) {
      const arrI = arr[i]
      if (arrI !== 0) {
        let resultLastIndex = result[result.length - 1]
        if (arrI > arr[resultLastIndex]) {
          p[i] = resultLastIndex
          result.push(i)
          continue
        }
        // 二分查找
        start = 0
        end = result.length - 1
        while (start < end) {
          middle = Math.floor((start + end) / 2)
          if (arr[result[middle]] < arrI) {
            start = middle + 1
          } else {
            end = middle - 1
          }
        }
        if (arrI < arr[result[start]]) {
          if (start > 0) {
            p[i] = result[start - 1]
          }
          result[start] = i
        }
      }
    }
    let l = result.length
    let last = result[l - 1]
    while (l-- > 0) {
      result[l] = last
      last = p[last]
    }
    return result
  }

  const patchChildren = (n1, n2, el) => {
    const c1 = n1.children
    const c2 = n2.chilren
    // 新的有儿子，老的有儿子，新老都有儿子，新老都是文本
    const prevShapeFlag = c1.shapeFlag
    const shapeFlag = n2.shapeFlag
    // 新的儿子是文本
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 旧的儿子是数组
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 删除儿子
        unmounChildren(c1)
      }
      // 新老儿子都是文本
      if (c1 !== c2) {
        hostSetElementText(el, c2)
      }
    } else {
      // 新的儿子是数组
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 新老儿子都是数组
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // diff 算法核心
          patchKeyedChildren(c1, c2, el)
        } else {
          unmounChildren(c1)
        }
      } else {
        // 老的儿子是文本
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(el, '')
        }
        // 新的儿子是数组
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, el)
        }
      }
    }
  }

  const processElement = (n1, n2, container, anchor) => {
    if (!n1) {
      // 挂载元素
      mountElement(n2, container, anchor)
    } else {
      // 更新元素
      patchElement(n1, n2, container)
    }
  }

  const processText = (n1, n2, container) => {
    if (!n1) {
      hostInsert(n2.el = hostCreateText(n2.children), container)
    }
  }

  const isSameVnode = (n1, n2) => n1.type === n2.type && n1.key === n2.key

  const unmout = (n1) => {
    // 如果是组件，还需要调用组件的销毁方法
    hostRemove(n1.el)
  }

  const patch = (n1, n2, container, anchor = null) => {
    const { shapeFlag, type } = n2
    // n1 和 n2 不是相同节点，删除 n1, 挂载 n2
    if (n1 && !isSameVnode(n1, n2)) {
      anchor = hostNextSibling(n1.el)
      unmout(n1)
      n1 = null
    }
    switch (type) {
      case Text:
        processText(n1, n2, container)
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          console.log('元素')
          processElement(n1, n2, container, anchor)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          console.log('组件')
          processComponent(n1, n2, container)
        }
        break;
    }
  }

  const render = (n2, container) => {
    patch(null, n2, container)
  }
  return {
    createApp: createAppAPI(render)
  }
}