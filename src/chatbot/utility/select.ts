import Discord from 'discord.js'

import {emojiAction} from './action'

const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
export const emojiSelect = <T extends string>(
  channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel,
  question: {
    title: string
    description: string
  },
  options: T[],
  additional?: {
    duration?: number
    author?: Discord.User
    timeout?: () => void
  }
) => new Promise<T>(async(resolve) => {
  const totalPage = Math.ceil(options.length / 10)
  let index:number | undefined = 0
  do {
    const currentOptions = options.slice(index * 10, (index + 1) * 10)
    const message = await channel.send({
      embed: {
        title: question.title,
        description: question.description + '\n\u200b\n' +
          currentOptions.map((option, index) =>
            `\`${(index + 1 + '.').padEnd(3)}\`${option}`.replace('``', '')
          ).join('\n') + '\n\u200b\n' +
          'Just click or tap the emoji below',
        footer: totalPage > 1
          ? {text:`page ${index + 1} of ${totalPage}`}
          : undefined
      }
    })
    const chosen = await emojiAction(
      message,
      [
        ...emojis.slice(0, currentOptions.length),
        index > 0? '⏪':undefined,
        index + 1 < totalPage? '⏩':undefined
      ].flatMap(emoji => emoji? [emoji]:[]),
      additional
    )
    if(chosen === '⏪') {
      await message.delete()
      index -= 1
    } else if(chosen === '⏩') {
      await message.delete()
      index += 1
    } else {
      index = undefined
      resolve(currentOptions[emojis.indexOf(chosen)] as T)
    }
  } while(index !== undefined)
})

export const emojiMultiSelect = <T extends string>(
  channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel,
  question: {
    title: string
    description: string
  },
  options: T[],
  additional?: {
    disabled?: boolean
    throttle?: number
    duration?: number
    author?: Discord.User
    timeout?: () => void
  }
) => new Promise<T[]>(async(resolve) => {
  const totalPage = Math.ceil(options.length / 10)
  let chosen:T[] = []
  let index:number | undefined = 0
  do {
    const currentOptions = options.slice(index * 10, (index + 1) * 10)
    const getCurrentMessage = () => ({
      embed: {
        title: question.title,
        description: question.description + '\n\u200b\n' +
          currentOptions.map((option, index) =>
            `\`${
              (index + 1 + '.').padEnd(3)
            }${
              !additional?.disabled
                ? chosen.includes(option)? '✓ ':'  '
                : ''
            }\`${option}`.replace('``', '')
          ).join('\n') + '\n\u200b\n' +
          'Just click or tap the emoji below',
        footer: index && totalPage > 1
          ? {text:`page ${index + 1} of ${totalPage}`}
          : undefined
      }
    })
    const message = await channel.send(getCurrentMessage())
    const currentEmojis:string[] = [
      ...!additional?.disabled
        ? emojis.slice(0, currentOptions.length)
        : [],
      index > 0? '⏪':undefined,
      index + 1 < totalPage? '⏩':undefined,
      !additional?.disabled? '✅':undefined
    ].flatMap(emoji => emoji? [emoji]:[])
    const next = await new Promise<'⏪' | '⏩' | '✅'>(resolve => {
      let end = false
      let next:'⏪' | '⏩' | '✅'
      const react = async() => {
        for(const emoji of currentEmojis) {
          try {
            if(!end) await message.react(emoji)
          } catch(error) {
            break
          }
        }
      }
      const reacting = react()
      const findEmoji = (reaction:Discord.MessageReaction) =>
        (emoji:string | Discord.GuildEmoji) => reaction.emoji.name === (typeof emoji === 'string'? emoji:emoji.name)
      const reactionCollector = message.createReactionCollector(
        (reaction:Discord.MessageReaction, user:Discord.User) => 
          (additional?.author
            ? user.id === additional.author.id
            : user.id !== message.author.id) &&
          currentEmojis.some(findEmoji(reaction)),
        {time:additional?.duration ?? 60000, dispose:true}
      )
      reactionCollector.on('collect', (reaction:Discord.MessageReaction) => {
        if(!additional?.author || reaction.users.cache.some(user => user.id === additional.author?.id)) {
          const found = currentEmojis.find(findEmoji(reaction))
          if(found && ['⏪', '⏩', '✅'].includes(found)) {
            reactionCollector.stop()
            next = found as '⏪' | '⏩' | '✅'
          } else if(found) {
            const chose = currentOptions[emojis.indexOf(found)] as T
            if(!chosen.includes(chose)) {
              chosen = [...chosen, chose]
            }
            message.edit(getCurrentMessage())
          }
        }
      })
      reactionCollector.on('remove', (reaction:Discord.MessageReaction) => {
        if(!additional?.author || reaction.users.cache.some(user => user.id === additional.author?.id)) {
          const found = currentEmojis.find(findEmoji(reaction))
          if(found) {
            const chose = currentOptions[emojis.indexOf(found)] as T
            if(chosen.includes(chose)) {
              chosen = chosen.filter(chosen => chosen !== chose)
            }
            message.edit(getCurrentMessage())
          }
        }
      })
      reactionCollector.on('end', async() => {
        end = true
        await reacting
        if(!message.deleted) {
          await message.reactions.removeAll()
          resolve(next)
        }
      })
    })
    if(next === '⏪') {
      await message.delete()
      index -= 1
    } else if(next === '⏩') {
      await message.delete()
      index += 1
    } else if(next === '✅') {
      index = undefined
      resolve(chosen)
    } else {
      index = undefined
      resolve([])
    }
  } while(index !== undefined)
})
