export const conjuctJoin = (words:string[]) =>
  [words.slice(0, words.length - 1).join(', '), words.slice(words.length - 1)].filter(sentence => sentence !== '').join(' and ')

export const pluralize = (
  amount: number | string | string[],
  verb: string,
  option?: { hideAmount?: boolean, determiner?: boolean }
) => {
  const number = typeof amount === 'string' ? parseInt(amount) : amount
  return `${
    option?.hideAmount
      ? ''
      : (number === 1 && option?.determiner
          ? /^[aeiou]/.test(verb)
            ? 'an'
            : 'a'
          : amount) + ' '
  }${
    number <= 1
      ? verb
      : verb.endsWith('y') &&
        !verb.endsWith('ay') &&
        !verb.endsWith('ey') &&
        !verb.endsWith('iy') &&
        !verb.endsWith('oy') &&
        !verb.endsWith('uy')
      ? verb.replace(/y$/, 'ies')
      : verb + 's'
  }`
}