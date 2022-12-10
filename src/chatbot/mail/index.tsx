import * as React from 'react'
import * as ReactDOM from 'react-dom/server'
import fetch from 'node-fetch'

import {conjuctJoin, pluralize} from '../../utility/string'
import {processMarkDown} from '../../utility/markdown'
import {emojiAction} from '../utility/action'
import {Method} from '../'

const fromRegExp = /^[\w-\.]+$/
const toRegExp = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
const method:Method = async(utilities, client, {message, argument}) => {
  const {
    sendGridAPI
  } = utilities
  const details = argument.split('\n')[0]
  const subject = argument.split('\n')[1]
  const text = argument.split('\n').slice(2).join('\n')
  const from = details?.split(' ')
    .find(detail => detail.startsWith('from:'))
    ?.replace(/^from\:/, '')
  const tos = details?.split(' ')
    .find(detail => detail.startsWith('to:'))
    ?.replace(/^to\:/, '')
    .split(',')
  if(!from || !fromRegExp.test(from)) {
    message.reply(`from address, ${from}@hypegienic.com is invalid`)
  } else if(!tos || !tos.every(to => toRegExp.test(to))) {
    message.reply(`to address, ${conjuctJoin(tos?.filter(to =>
      !toRegExp.test(to)
    )?? [])} is invalid`)
  } else if(!subject || !text) {
    message.reply('subject or content is empty')
  } else {
    const files = await Promise.all(
      message.attachments.map(async attachment => {
        const file = await fetch(attachment.url, {
          method: 'GET'
        }).then(response => response.buffer())
        return {
          filename: attachment.name ?? attachment.url.split('/').pop() ?? '',
          content: file.toString('base64'),
          disposition: 'attachment'
        }
      })
    )
    const sent = await message.channel.send({
      embed: {
        title: 'Send email',
        description: [
          `**from** ${from}@hypegienic.com`,
          `**to** ${conjuctJoin(tos)}`
        ].join('\n'),
        fields: [{
          name: subject,
          value: text
        }],
        footer: files.length > 0
          ? {
              text: `${pluralize(files.length, 'file')} attached`
            }
          : undefined
      }
    })
    const markedDownSubject = processMarkDown(subject)
    const markedDownText = processMarkDown(text)
    let markedDownParagraph:typeof markedDownText[] = [[]]
    for(const markedDown of markedDownText) {
      const contents = markedDown.content.split('\n')
      markedDownParagraph[markedDownParagraph.length - 1]?.push({
        ...markedDown,
        content: contents[0]?? ''
      })
      for(const nextLine of contents.slice(1)) {
        markedDownParagraph.push([{
          ...markedDown,
          content: nextLine
        }])
      }
    }
    const action = await emojiAction(sent, ['✅', '❎'])
    if(action === '✅') {
      await sendGridAPI.send({
        to: tos,
        from: `${from}@hypegienic.com`,
        subject: markedDownSubject.reduce((text, markdown) => text + markdown.content, ''),
        text: markedDownText.reduce((text, markdown) => text + markdown.content, ''),
        html: ReactDOM.renderToString(
          <div>{markedDownParagraph.map((paragraph, index) =>
            <p key={index}>{paragraph.map((line, index) =>
              <span key={index} style={{
                fontWeight: line.bold? 600:400,
                fontStyle: line.italic? 'italic':'normal'
              }}>
                {line.content}
              </span>
            )}</p>
          )}</div>
        ),
        attachments: files
      })
      await message.reply(`email sent to ${conjuctJoin(tos)}`)
    } else {
      await sent.delete()
    }
  }
}
export default method