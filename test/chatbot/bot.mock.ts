import Discord from 'discord.js'

import DiscordChatbot, {ChatbotUtility} from '../../src/chatbot'

type Message = {embed?:Partial<Discord.MessageEmbed>, files?:Discord.MessageAttachment[]}
class MockDiscordChatbot extends DiscordChatbot {
  // guild:Discord.Guild
  // channel:Discord.TextChannel
  sentMessages:Record<string, Message[]> = {}
  constructor(utilities:ChatbotUtility) {
    super('', {} as any)
    // this.client = new Discord.Client()
    // this.guild = new Discord.Guild(this.client, {})
    // this.channel =  new Discord.TextChannel(this.guild, {})
    // this.channel.send = this.chatbotSendMessage
    // this.utilities = utilities
  }
  destroy = () => {
    this.client?.removeAllListeners()
    this.client?.destroy()
  }

  // messageId = 0
  // receiveMessage = async(message:string) => {
  //   const sendMessage = new Discord.Message(
  //     this.client,
  //     {
  //       id: this.messageId.toString(),
  //       content: message,
  //       author: {
  //         id: 'chingyawhao',
  //         bot: false
  //       }
  //     },
  //     this.channel
  //   )
  //   sendMessage.reply = this.chatbotSendMessage
  //   this.messageId++
  //   await this.processMessage(sendMessage)
  // }
  // private chatbotSendMessage = (async(message:Message) => {
  //   this.sendMessage('chatbot', message)
  //   const sendMessage = new Discord.Message(
  //     this.client,
  //     {
  //       id: this.messageId.toString(),
  //       content: message,
  //       author: {}
  //     },
  //     this.channel
  //   )
  //   this.messageId++
  //   return sendMessage
  // }) as any

  sendMessage = async(channel:string, message:Message) => {
    if(!this.sentMessages[channel]) this.sentMessages[channel] = []
    this.sentMessages[channel]?.push(message)
    return message as any
  }
}

export default MockDiscordChatbot