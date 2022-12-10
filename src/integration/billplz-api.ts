import fetch from 'node-fetch'
import FormData from 'form-data'
import * as crypto from 'crypto'

class BillPlzAPI {
  private host:string
  private secrets:{collection:string, key:string, signature:string}
  constructor(host:string, secrets:{collection:string, key:string, signature:string}) {
    this.host = host
    this.secrets = secrets
  }
  requestTopUp = (request:TopUpRequest):Promise<TopUpResponse> => {
    const form = new FormData()
    form.append('collection_id', this.secrets.collection)
    form.append('name', request.name)
    form.append('email', request.email)
    form.append('description', request.description)
    form.append('amount', request.amount)
    form.append('callback_url', HOST + '/billplz-result')
    return fetch(this.host + '/v3/bills', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${this.secrets.key}:`).toString('base64')
      },
      body: form
    })
      .then(response => response.json())
  }
  checkSignatureAuthorized = (request:Record<string, string>) => {
    const sourceString = Object.keys(request)
      .filter(key => key !== 'x_signature')
      .map(key => `${key}${request[key]}`)
      .sort()
      .join('|')
    const hash = crypto.createHmac('sha256', this.secrets.signature)
    hash.update(sourceString)
    return request['x_signature'] === hash.digest('hex')
  }
}
export type TopUpRequest = {
  name: string
  email: string
  description: string
  amount: number
}
export type TopUpResponse = {
  id: string
  collection_id: string
  paid: boolean
  state: 'due' | 'paid' | 'deleted'
  amount: number
  paid_amount: number
  due_at: string
  email: string
  mobile: null
  name: string
  url: string
  redirect_url: null
  callback_url: string
  description: string
}
export default BillPlzAPI