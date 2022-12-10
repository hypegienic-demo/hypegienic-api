import Discord from 'discord.js'

export const emojiAction = <T extends string | Discord.GuildEmoji>(
  message:Discord.Message,
  emojis: T[],
  additional?: {
    duration?: number
    author?: Discord.User
    timeout?: () => void
  }
) => new Promise<T>(resolve => {
  let end = false
  let chosen:T
  const react = async() => {
    for(const emoji of emojis) {
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
      emojis.some(findEmoji(reaction)),
    {time:additional?.duration ?? 60000}
  )
  reactionCollector.on('collect', (reaction:Discord.MessageReaction) => {
    if(!additional?.author || reaction.users.cache.some(user => user.id === additional.author?.id)) {
      const found = emojis.find(findEmoji(reaction))
      if(found) {
        reactionCollector.stop()
        chosen = found
      }
    }
  })
  reactionCollector.on('end', async() => {
    end = true
    await reacting
    if(!message.deleted) {
      await message.reactions.removeAll()
      resolve(chosen)
    }
  })
})