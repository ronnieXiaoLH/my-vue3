export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  SIMPLE_EXPRESSION = 4,
  INTERPOLATION = 5,
  ATTRIBUTE = 6,
  DIRECTIVES = 7,
  COMPOUND_EXPRESSION = 8,
  TEXT_CALL = 12,
  VNODE_CALL = 13
}

function createParserContext(content) {
  return {
    line: 1,
    column: 1,
    offset: 0,
    source: content,
    originalSource: content
  }
}

function isEnd(context) {
  const source = context.source
  if (source.startsWith('</')) {
    return true
  }
  return !source
}

function advanceSpaces(context) {
  const reg = /^[ \n\r\t]+/
  const match = reg.exec(context.source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

function parseTag(context) {
  const start = getCursor(context)
  const reg = /^<\/?([a-z][^ \t\r\n/>]*)/i
  const match = reg.exec(context.source)
  const tag = match[1]
  advanceBy(context, match[0].length)
  advanceSpaces(context)
  // 判断是不是自闭和标签
  const isSelfClose = context.source.startsWith('/>')
  advanceBy(context, isSelfClose ? 2 : 1)
  return {
    type: NodeTypes.ELEMENT,
    tag,
    isSelfClose,
    loc: getSelection(context, start)
  }
}

function parseElement(context) {
  let ele: any = parseTag(context)
  const children = parseChildren(context)
  if (context.source.startsWith('</')) {
    parseTag(context)
  }
  ele.children = children
  ele.loc = getSelection(context, ele.loc.start)
  return ele
}

function parseInterpolation(context) {
  const start = getCursor(context)
  const closeIndex = context.source.indexOf('}}', '{{')
  advanceBy(context, 2)
  let innerStart = getCursor(context)
  let innerEnd = getCursor(context)
  const rawContentLength = closeIndex - 2
  const preTrimContent = parseTextData(context, rawContentLength)
  const content = preTrimContent.trim()
  const startOffset = preTrimContent.indexOf(content)
  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, preTrimContent, startOffset)
  }
  const endOffset = content.length + startOffset
  advancePositionWithMutation(innerEnd, preTrimContent, endOffset)
  advanceBy(context, 2)
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      loc: getSelection(context, innerStart, innerEnd)
    },
    loc: getSelection(context, start)
  }
}

function getCursor(context) {
  let { line, column, offset } = context
  return {
    line,
    column,
    offset
  }
}

function parseTextData(context, endIndex) {
  let rawText = context.source.slice(0, endIndex)
  advanceBy(context, endIndex)
  return rawText
}

function advancePositionWithMutation(context, s, endIndex) {
  // 更新 行、列和偏移量
  let linesCount = 0
  let linePos = -1
  for (let i = 0; i < endIndex; i++) {
    // 计算有多少换行符
    if (s.charCodeAt(i) === 10) {
      linesCount++
      linePos = i
    }
  }
  context.line += linesCount
  context.offset += endIndex
  context.column = linePos === -1 ? context.column + endIndex : endIndex - linePos
}

function getSelection(context, start, end?) {
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  }
}

function advanceBy(context, endIndex) {
  let s = context.source
  // 更新 source
  context.source = s.slice(endIndex)
  // 更新结束位置
  advancePositionWithMutation(context, s, endIndex)
}

function parseText(context) {
  const endTokens = ['<', '{{']
  let endIndex = context.source.length
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }
  // 根据文本的结束位置，更新行列信息
  let start = getCursor(context)
  const content = parseTextData(context, endIndex)
  return {
    type: NodeTypes.TEXT,
    loc: getSelection(context, start),
    content
  }
}

function parseChildren(context) {
  const nodes = []
  while (!isEnd(context)) {
    const s = context.source
    let node
    if (s[0] === '<') {
      node = parseElement(context)
    } else if (s.startsWith('{{')) {
      node = parseInterpolation(context)
    } else {
      node = parseText(context)
    }
    nodes.push(node)
  }
  nodes.forEach((node, index) => {
    if (node.type === NodeTypes.TEXT) {
      if (!/[^ \r\t\n]/.test(node.text)) {
        nodes[index] = null
      } else {
        node.content = node.content.replace(/^[ \r\t\n]+/g, ' ')
      }
    }
  })
  return nodes.filter(Boolean)
}

function createRoot(children, loc) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc
  }
}

export function baseParse(content) {
  const context = createParserContext(content)
  const start = getCursor(context)
  return createRoot(parseChildren(context), getSelection(context, start))
}