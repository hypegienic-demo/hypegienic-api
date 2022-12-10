import * as FirebaseAdmin from 'firebase-admin'

import GmailAPI, {Mail} from '../../src/integration/gmail-api'

export default class MockGmailAPI extends GmailAPI {
  constructor() {
    super(null as unknown as FirebaseAdmin.ServiceAccount)
  }
  sent:Mail[] = []
  send = async(mail:Mail) => {
    this.sent.push(mail)
    return [] as any
  }
}