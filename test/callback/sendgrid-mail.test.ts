import {Server} from 'http'
import requires from 'supertest'
import {customAlphabet} from 'nanoid'
import fetch from 'node-fetch'

import Chatbot from '../chatbot/bot.mock'

import {runTestingApp} from '../'

describe('billplz-result', () => {
  let server:Server
  let chatbot:Chatbot

  beforeAll(async() => {
    const app = await runTestingApp()
    server = app.server
    app.utilities.chatbot.sendMessage = jest.fn()
    chatbot = app.utilities.chatbot
  })

  it('should send a discord message when an email is received', async() => {
    const request = requires(server)
      .post('/sendgrid-mail')
    request.field('headers', [
      `Received: by mx0047p1mdw1.sendgrid.net with SMTP id 6WCVv7KAWn ${new Date().toUTCString()} (UTC)`,
      `Received: from mail-io0-f169.google.com (mail-io0-f169.google.com [209.85.223.169]) by mx0047p1mdw1.sendgrid.net (Postfix) with ESMTPS id AA9FFA817F2 for <example@hypegienic.com>; ${new Date().toUTCString()} (UTC)`,
      `Received: by mail-io0-f169.google.com with SMTP id b62so81593819iod.3 for <example@hypegienic.com>; ${new Date().toUTCString()} (PDT)`,
      `DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=sendgrid.com; s=ga1; h=mime-version:from:date:message-id:subject:to; bh=DpB1CYYeumytcPF3q0Upvx3Sq/oF4ZblEwnuVzFwqGI=; b=GH5YTxjt6r4HoTa+94w6ZGQszFQSgegF+Jlv69YV76OLycJI4Gxdwfh6Wlqfez5yID 5dsWuqaVJZQyMq/Dy/c2gHSqVo60BKG56YrynYeSrMPy8abE/6/muPilYxDoPoEyIr/c UXH5rhOKjmJ7nICKu1o99Tfl0cXyCskE7ERW0=`,
      `X-Google-DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=1e100.net; s=20130820; h=x-gm-message-state:mime-version:from:date:message-id:subject:to; bh=DpB1CYYeumytcPF3q0Upvx3Sq/oF4ZblEwnuVzFwqGI=; b=Sq6LVHbmywBdt3sTBn19U8VOmelfoJltz8IcnvcETZsYwk96RBxN+RKMN5fOZSKw4j 15HrgdIFfyDmp67YK0ygvOITlTvZ6XY5I0PtnvDtAQt79kS3tKjI3QKJoEp/ZjIjSzlL KG7agl6cxFgBbIN0yHWBOvy3O+ZXY8tZdom1yOvULjmjW1U9JkdOs+aJ6zq4qhZX/RM/ tIgLB461eJ5V95iQDDc5Ibj9Cvy4vJfXLQRO0nLVQAT2Yz58tkEO1bDZpWOPAyUNneIL yhIWp+SpbuqhMA68mq0krG1PjmWalUbpVcGJIGuOKB9mQFFo/MqdrUCjvYnyo1jPLPeX psdQ==`,
      `X-Gm-Message-State: AEkoousvdxmDoxLlTUYJ1AOmCGJv77xRBBlfKv6YrthH0M2NueMwlOxUD6t8nidE9uonXbdJ/DQy/chmHUnN//a4`,
      `X-Received: by 10.107.6.101 with SMTP id 98mr38024553iog.41.1469652785829; ${new Date().toUTCString()} (PDT)`,
      `MIME-Version: 1.0`,
      `Received: by 10.107.48.17 with HTTP; ${new Date().toUTCString()} (PDT)`,
      `From: Example <example@example.com>`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <CAN_P_JMvV7ZpAQhOnDienypLrJmuhN=LQWweu4yScw4jQyXY2w@mail.gmail.com>`,
      `Subject: An E-Mail with File Attachments`,
      `To: example@hypegienic.com`,
      `Content-Type: multipart/mixed`
    ].join('\n'))
    request.field('to', 'example@hypegienic.com')
    request.field('from', 'Example <example@example.com>')
    request.field('subject', 'An E-Mail with File Attachments')
    request.field('text', "Here's an email with multiple file attachments")
    request.field('sender_ip', '209.85.223.169')
    const images = [{
      name: 'Spongebob.png',
      url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/SpongeBob_SquarePants_character.svg/1200px-SpongeBob_SquarePants_character.svg.png'
    }, {
      name: 'Patrick.png',
      url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/Patrick_Star.svg/1200px-Patrick_Star.svg.png'
    }]
    images.forEach((image, index) =>
      request.field('attachments', (index + 1).toString())
    )
    type AttachmentInfo = Record<string, {
      filename: string
      name: string
      type: string
      'content-id': string
    }>
    const generateContentId = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890_', 19)
    request.field('attachment-info', JSON.stringify(
      images.reduce<AttachmentInfo>((attachment, image, index) => ({
        ...attachment,
        [`attachment${index + 1}`]: {
          filename: image.name,
          name: image.name,
          type: 'image/png',
          'content-id': generateContentId()
        }
      }), {})
    ))
    await Promise.all(images.map(async(image, index) => {
      const file = await fetch(image.url, {
        method: 'GET'
      }).then(response => response.buffer())
      request.attach(`attachment${index + 1}`, file, image.name)
    }))
    await request.expect(204)

    expect(chatbot.sendMessage).toHaveBeenCalledWith(
      'mail', {
        embed: {
          title: 'New email',
          description: [
            '**from** example@example.com',
            '**to** example@hypegienic.com'
          ].join('\n'),
          fields: [{
            name: 'An E-Mail with File Attachments',
            value: "Here's an email with multiple file attachments",
            inline: false
          }],
          footer: {
            text: 'CAN_P_JMvV7ZpAQhOnDienypLrJmuhN=LQWweu4yScw4jQyXY2w@mail.gmail.com'
          }
        }
      }
    )
    expect(chatbot.sendMessage).toHaveBeenCalledWith(
      'mail', 
      expect.objectContaining({
        files: expect.arrayContaining([{
          name: 'Spongebob.png',
          attachment: expect.stringMatching(/.+\.png$/)
        }, {
          name: 'Patrick.png',
          attachment: expect.stringMatching(/.+\.png$/)
        }])
      })
    )
  })

  afterAll(async() => {
    await server.close()
  })
})