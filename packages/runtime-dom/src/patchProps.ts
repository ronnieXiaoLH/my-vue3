import { patchAttr } from "./modules/attr";
import { patchClass } from "./modules/class";
import { patchEvent } from "./modules/event";
import { patchStyle } from "./modules/style";

export const patchProp = (el, key, prevValue, nextValue) => {
  switch (key) {
    case 'class':
      patchClass(el, nextValue)
      break;
    case 'style':
      patchStyle(el, prevValue, nextValue)
      break;
    default:
      const reg = /^on[^a-z]/
      // 事件
      if (reg.test(key)) {
        patchEvent(el, key, nextValue)
      } else {
        // 其他属性
        patchAttr(el, key, nextValue)
      }
      break;
  }
}