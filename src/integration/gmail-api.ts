import * as FirebaseAdmin from 'firebase-admin'
import {google} from 'googleapis'
import MailComposer from 'nodemailer/lib/mail-composer'

class GmailAPI {
  private client:any
  constructor(credentials:FirebaseAdmin.ServiceAccount) {
    this.client = credentials
      ? new google.auth.JWT(
          (credentials as any).client_email,
          undefined,
          (credentials as any).private_key,
          ['https://www.googleapis.com/auth/gmail.send'],
          'bryan.chye@hypeguardian.com'
        )
      : undefined
  }

  send = async(mail:Mail) => {
    const composer = new MailComposer({
      from: 'support@hypeguardian.com',
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      textEncoding: 'base64',
      attachments: mail.attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
        encoding: 'base64'
      }))
    })
    const message = await composer.compile().build()
    const encoded = message.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    await this.client.authorize()
    await google.gmail('v1').users.messages.send({
      auth: this.client,
      userId: 'me',
      requestBody: {
        raw: encoded
      }
    })
  }
}
export type Mail = {
  to: string
  subject: string
  text: string
  attachments: {
    filename: string
    content: Buffer
  }[]
}
export default GmailAPI