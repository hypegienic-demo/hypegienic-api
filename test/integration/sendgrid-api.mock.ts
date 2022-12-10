import SendGrid from '@sendgrid/mail'

import SendGridAPI from '../../src/integration/sendgrid-api'

export default class MockSendGridAPI extends SendGridAPI {
  constructor() {
    super('')
  }
  sent:SendGrid.MailDataRequired[] = []
  send = async(mail:SendGrid.MailDataRequired) => {
    this.sent.push(mail)
    return [] as any
  }
}