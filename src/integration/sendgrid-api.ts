import SendGrid from '@sendgrid/mail'

class SendGridAPI {
  constructor(key:string) {
    if(key) {
      SendGrid.setApiKey(key)
    }
  }
  send = (mail:SendGrid.MailDataRequired) => SendGrid.send(mail)
}
export default SendGridAPI