import {processMarkDown} from '../../src/utility/markdown'

describe('markdown', () => {
  it('should not mardown when none', async() => {
    const markedDown = processMarkDown(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
      `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
      `Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ` +
      `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    )
    expect(markedDown).toEqual([{
      content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
        `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
        `Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ` +
        `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    }])
  })
  it('should mardown bold', async() => {
    const markedDown = processMarkDown(
      `Lorem ipsum dolor sit amet, **consectetur adipiscing elit**, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
      `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
      `Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ` +
      `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    )
    expect(markedDown).toEqual([{
      content: `Lorem ipsum dolor sit amet, `
    }, {
      content: `consectetur adipiscing elit`,
      bold: true
    }, {
      content: `, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
        `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
        `Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ` +
        `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    }])
  })
  it('should mardown italic', async() => {
    const markedDown = processMarkDown(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
      `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
      `Duis aute irure dolor in reprehenderit in voluptate velit *esse cillum dolore eu fugiat nulla pariatur*. ` +
      `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    )
    expect(markedDown).toEqual([{
      content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
        `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
        `Duis aute irure dolor in reprehenderit in voluptate velit `
    }, {
      content: `esse cillum dolore eu fugiat nulla pariatur`,
      italic: true
    }, {
      content: `. ` +
        `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    }])
  })
  it('should mardown bold and italic 1', async() => {
    const markedDown = processMarkDown(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
      `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
      `Duis aute irure dolor in **reprehenderit in voluptate velit *esse cillum** dolore eu fugiat nulla pariatur*. ` +
      `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    )
    expect(markedDown).toEqual([{
      content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
        `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
        `Duis aute irure dolor in `
    }, {
      content: `reprehenderit in voluptate velit `,
      bold: true
    }, {
      content: `esse cillum`,
      bold: true,
      italic: true
    }, {
      content: ` dolore eu fugiat nulla pariatur`,
      italic: true
    }, {
      content: `. ` +
        `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    }])
  })
  it('should mardown bold and italic 2', async() => {
    const markedDown = processMarkDown(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
      `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
      `Duis aute irure dolor in ***reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur***. ` +
      `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    )
    expect(markedDown).toEqual([{
      content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
        `Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ` +
        `Duis aute irure dolor in `
    }, {
      content: `reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur`,
      bold: true,
      italic: true
    }, {
      content: `. ` +
        `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
    }])
  })
})