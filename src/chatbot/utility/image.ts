import Discord from 'discord.js'
import fetch from 'node-fetch'

export const requestImages = async(
  channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel,
  question: string,
  additional?: {
    duration?: number
    author?: Discord.User
  }
) => new Promise<Image[]>(async(resolve) => {
  const message = await channel.send(`> ${question}`)
  const messageCollector = channel.createMessageCollector(
    (newMessage:Discord.Message) =>
      (additional?.author
        ? newMessage.author.id === additional.author.id
        : newMessage.author.id !== message.author.id) &&
      newMessage.reference?.messageID === message.id,
    {time:additional?.duration ?? 60000, dispose:true}
  )
  let images:Image[]
  messageCollector.on('collect', async(message:Discord.Message) => {
    images = await Promise.all(message.attachments.map(async(attachment) => {
      const buffer = await fetch(attachment.url, {
        method: 'GET'
      }).then(response => response.buffer())
      return {
        name: attachment.name ?? '',
        buffer
      }
    }))
    if(images.length > 0) {
      messageCollector.stop()
    }
  })
  messageCollector.on('end', async() => {
    resolve(images ?? [])
  })
})
export type Image = {
  name: string
  buffer: Buffer
}