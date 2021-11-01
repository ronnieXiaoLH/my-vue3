import { baseParse, NodeTypes } from "./parse"

function transformElement(node, context) {
  if (node.type !== NodeTypes.ELEMENT) return
  console.log(node, context, '元素节点')
  return () => {

  }
}

function isText(node) {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}

function transformText(node, context) {
  if (node.type === NodeTypes.ROOT || node.type === NodeTypes.ELEMENT) {
    return () => {
      // 对元素中的文本进行合并操作
      let hasText = false
      let children = node.children
      let container = null
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          // 文本节点后面的节点也是文本节点，需要合并文本
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!container) {
                container = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  loc: child.loc,
                  children: [child]
                }
                container.children.push('+', next)
                children.splice(j, 1)
                j--
              }
            } else {
              container = null
            }
          }
        }
      }
      if (!hasText || children.length === 1) return
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {

        }
      }
    }
  }
}

function getBaseTransformPreset() {
  return [
    transformElement,
    transformText
  ]
}

// 创建 context 的目的是传参方便
function createTransformContext(root, nodesTransform) {
  const context = {
    root, // 根几点
    currentNode: root, // 当前节点
    nodesTransform, // 转换的方法
    helpers: new Set(),
    helper(name) {
      context.helpers.add(name)
    }
  }
  return context
}

function traverseChildren(node, context) {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    traverseNode(child, context)
  }
}

function traverseNode(node, context) {
  const { nodesTransform } = context
  const exits = []
  context.currentNode = node
  for (let i = 0; i < nodesTransform.length; i++) {
    const onExist = nodesTransform[i](node, context)
    if (onExist) {
      exits.push(onExist)
    }
  }
  switch (node.type) {
    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT:
      traverseChildren(node, context)
      break;
    default:
      break;
  }
  context.currentNode = node
  let i = exits.length
  while (i--) {
    exits[i]()
  }
}

function transform(root, options) {
  const { nodesTransform } = options
  const context = createTransformContext(root, nodesTransform)
  // 遍历 ast
  traverseNode(root, context)
}

export function baseCompile(template) {
  // 1. 将模板转换成 ast 
  const ast = baseParse(template)
  console.log(ast)
  // 2. transform ast (优化、静态提升、方法缓存)
  const nodesTransform = getBaseTransformPreset()
  transform(ast, { nodesTransform })
  return ast
}