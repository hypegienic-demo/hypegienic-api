import Discord from 'discord.js'

import {Utilities} from '../app'
import {registerFonts} from './utility/canvas'
// import show from './show'
// import status from './status'

export type ChatbotUtility = Omit<Utilities, 'chatbot'>
export type Method = (
  utilities: ChatbotUtility,
  client: Discord.Client,
  input: {
    message: Discord.Message,
    argument: string
  }
) => Promise<void>
class DiscordChatbot {
  private token:string
  protected client:Discord.Client
  protected utilities:ChatbotUtility
  constructor(token:string, utilities:ChatbotUtility) {
    this.token = token
    this.client = token
      ? new Discord.Client()
      : undefined as any
    this.utilities = utilities
  }

  login = async() => {
    this.client.login(this.token)
    await Promise.all([
      new Promise<void>(resolve => this.client.on('ready', () => resolve())),
      registerFonts()
    ])
    this.client.on('message', this.processMessage)
    this.client.on('disconnect', () => {
      this.client.destroy()
    })
  }

  protected processMessage = async(message:Discord.Message) => {
    const startsWith = [DISCORD_SETTING.prefix, ...this.client.user? [`<@${this.client.user.id}> `, `<@!${this.client.user.id}> `]:[]]
      .find(startWith => message.content.startsWith(startWith))
    // if(startsWith && !message.author.bot && message.author.id !== this.client.user?.id) {
    //   const contents = message.content.slice(startsWith.length).split(' ')
    //   await this.executeCommand(
    //     contents[0],
    //     [{
    //       commands: ['show'],
    //       lambda: show,
    //       directMessage: false
    //     }, {
    //       commands: ['status'],
    //       lambda: status,
    //       directMessage: false
    //     }],
    //     this.client,
    //     message,
    //     contents.slice(1).join(' ')
    //   )
    // }
  }
  private executeCommand = async(
    command: string,
    actions: {
      commands: string[],
      lambda: Method,
      directMessage: boolean
    }[],
    client: Discord.Client,
    message: Discord.Message,
    argument: string
  ) => {
    const action = actions.find(action =>
      action.commands.includes(command.toLowerCase())
    )
    if(action) {
      if(message.channel.type === 'dm' && !action.directMessage) {
        await message.channel.send('Chatbot will only respond in a server')
      } else {
        await action.lambda(this.utilities, client, {message, argument})
          .catch(error => {
            console.error(error)
            message.reply(`sorry...something went wrong`)
          })
      }
    }
  }

  sendMessage = async(channel:string, message:{embed?:Partial<Discord.MessageEmbed>, files?:Discord.MessageAttachment[]}) => {
    const server = this.client.guilds.cache.get(DISCORD_SETTING.server)
    const textChannel = server?.channels.cache.find(textChannel =>
      textChannel.isText() && textChannel.name === channel
    ) as Discord.TextChannel
    if(textChannel) {
      return textChannel.send(message as any)
    } else {
      throw new Error('Discord channel not found')
    }
  }
}

export default DiscordChatbot