const findIntersectRange = (stringA: string, stringB: string) => {
  let range: [number, number] | undefined = undefined
  for(const index of stringA.split('').map((_, index) => index)) {
    if(range?.[1] !== undefined && index - range[0] >= stringB.length) {
      break
    } else if(
      range?.[0] !== undefined &&
      stringA[index] === stringB[index - range[0]]
    ) {
      range[1] = index
    } else if(stringA[index] === stringB[0]) {
      range = [index, index]
    } else {
      range = undefined
    }
  }
  if(range?.[1] !== undefined) range[1] += 1
  return range
}
const intersect = (stringA: string, stringB: string) => {
  const reverseString = (string: string) =>
    string
      .split('')
      .reverse()
      .join('')
  return (
    findIntersectRange(stringA, stringB) ||
    findIntersectRange(reverseString(stringA), reverseString(stringB))
      ?.map(index => stringA.length - index)
      .reverse()
  )
}

const marks:MarkDownDefinition[] = [
  {symbol:'*', repeat:2, property:{bold:true}},
  {symbol:'*', repeat:1, property:{italic:true}}
]
const processingMarkDown = (markdowns: MarkDown[]): MarkDown[] => {
  const text = markdowns.map(markdown => markdown.content).join('')
  const matches = text.match(
    new RegExp(
      marks.map(mark => {
        const escaped = `\\${mark.symbol}{${mark.repeat}}`
        return `((?<!\\${mark.symbol})${escaped}.*?${escaped}(?!\\${mark.symbol}))`
      }).join('|'),
      'g'
    )
  )
  if(matches && matches.length > 0) {
    let markedDowned:MarkDown[] = []
    for(const match of matches) {
      const mark = marks.find(mark => match.startsWith(new Array(mark.repeat).fill(mark.symbol).join('')))
      for(const markedDown of [...markdowns]) {
        const range = intersect(markedDown.content, match)
        if(mark && range) {
          const escaped = `\\${mark.symbol}{${mark.repeat}}`
          markedDowned = [
            ...markedDowned,
            {...markedDown, content:markedDown.content.slice(0, range[0])},
            {
              ...markedDown,
              content:markedDown.content.slice(range[0], range[1])
                .replace(new RegExp(`^${escaped}|${escaped}$`, 'g'), ''),
              ...mark.property
            },
            {...markedDown, content:markedDown.content.slice(range[1])}
          ].filter(markDown => markDown.content.length > 0)
        } else {
          markedDowned = [...markedDowned, markedDown]
        }
      }
    }
    return processingMarkDown(markedDowned)
  } else {
    return markdowns
  }
}
export const processMarkDown = (paragraph: string): MarkDown[] => {
  return processingMarkDown([{
    content: paragraph
  }])
}
type MarkDownDefinition = {
  symbol: string
  repeat: number
  property: Omit<MarkDown, 'content'>
}
type MarkDown = {
  content: string
  bold?: boolean
  italic?: boolean
}
