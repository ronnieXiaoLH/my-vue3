export const patchStyle = (el, prevValue, nextValue) => {
  const style = el.style
  // 新的 style 没有值，直接清空
  if (!nextValue) {
    el.removeAttribute('style')
  } else {
    // 遍历新的style的属性，没有的直接赋值，有的直接新增
    for (let key in nextValue) {
      style[key] = nextValue[key]
    }
    // 遍历旧的style的属性，新的没有的删除
    if (prevValue) {
      for (let key in prevValue) {
        if (!nextValue[key]) {
          style[key] = ''
        }
      }
    }
  }
}