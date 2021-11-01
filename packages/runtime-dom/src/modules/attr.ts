export const patchAttr = (el, key, value) => {
  if (!value) {
    el.removeAttribute(key)
  } else {
    console.log(el, key, value)
    el.setAttribute(key, value)
  }
}