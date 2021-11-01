export const nodeOps = {
  // 新增元素
  createElement: (tagName) => document.createElement(tagName),
  // 删除元素
  remove: (child) => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },
  // 插入元素, anchor = null 相当于 appendChild
  insert: (child, parent, anchor = null) => parent.insertBefore(child, anchor),
  // 查找元素
  querySelector: (selector) => document.querySelector(selector),
  // 设置元素文本内容
  setElementText: (el, text) => {
    el.textContent = text
  },
  nextSibling: node => node.nextSibling,
  // 创建文本
  createText: text => document.createTextNode(text),
  // 设置文本
  setText: (node, text) => node.textContent = text
}