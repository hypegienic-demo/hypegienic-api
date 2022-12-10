import * as crypto from 'crypto'

import BillPlzAPI, {TopUpRequest, TopUpResponse} from '../../src/integration/billplz-api'

const makeString = (length: number) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890'
  return new Array(length).fill(undefined).map(_ =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join('')
}
export const dateString = (date: Date) => {
  const fillDigit = (number:number, digits:number) => {
    return new Array(digits - number.toString().length).fill('0').join('') + number
  }
  return `${date.getFullYear()}-${fillDigit(date.getMonth() + 1, 2)}-${fillDigit(date.getDate(), 2)}`
}
export const signRequest = (response:Record<string, string>) => {
  const sourceString = Object.keys(response)
    .filter(key => key !== 'x_signature')
    .map(key => `${key}${response[key]}`)
    .sort()
    .join('|')
  const hash = crypto.createHmac('sha256', 'sample-billplz-signature')
  hash.update(sourceString)
  return {
    ...response,
    x_signature: hash.digest('hex')
  }
}
export default class MockBillPlzAPI extends BillPlzAPI {
  constructor() {
    super('https://www.billplz.com/api', {
      collection: 'b7ssrir_',
      key: 'sample-billplz-key',
      signature: 'sample-billplz-signature'
    })
  }

  requestTopUp = async(request:TopUpRequest):Promise<TopUpResponse> => {
    const id = makeString(8)
    return {
      id,
      collection_id: 'b7ssrir_',
      paid: false,
      state: 'due',
      amount: request.amount,
      paid_amount: 0,
      due_at: dateString(new Date()),
      email: request.email,
      mobile: null,
      name: request.name,
      url: `https://www.billplz.com/bills/${id}`,
      redirect_url: null,
      callback_url: 'https://api.hypegienic.com/billplz-result',
      description: request.description
    }
  }
}