import * as Discord from 'discord.js'

import {conjuctJoin} from '../../utility/string'
import {Upload} from '../upload'
import {Route} from '..'

const route:Route<Request, void> = {
  type: 'post',
  path: '/sendgrid-mail',
  resolver: async(utilities, request) => {
    const {
      chatbot
    } = utilities
    const messageId = request.headers[0]
      ?.split('\n')
      .find(header => header.startsWith('Message-ID:'))
      ?.match(/\<.*\>/)?.[0]
      ?.slice(1,-1)
    await chatbot.sendMessage('mail', {
      embed: {
        title: 'New email',
        description: [
          `**from** ${conjuctJoin(
            request.from
              .flatMap(from => {
                const email = from.match(/\<.*\>/)?.[0]?.slice(1, -1)
                return email? [email]:[]
              })
          )}`,
          `**to** ${conjuctJoin(request.to)}`
        ].join('\n'),
        fields: [{
          name: request.subject.join('\n'),
          value: request.text.join('\n'),
          inline: false
        }],
        footer: messageId
          ? {text:messageId}
          : undefined
      }
    })
    const files = request.attachments
      .flatMap(attachment => {
        const files = request[`attachment${attachment}`]
        return files
          ?.map(file =>
            new Discord.MessageAttachment(
              file.path,
              file.originalFilename
            )
          )
          ?? []
      })
      .filter(attachment => !!attachment)
    if(files.length > 0) {
      await chatbot.sendMessage('mail', {files})
    }
  }
}
type Request = {
  headers: string[]
  to: string[]
  from: string[]
  subject: string[]
  text: string[]
  sender_ip: string[]
  attachments: string[]
  'attachment-info': string[]
} & Record<string, Upload[]>

export default route