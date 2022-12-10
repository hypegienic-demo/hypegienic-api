import requires from 'supertest'
import * as io from 'socket.io-client'
import * as websocket from 'ws'
import * as querystring from 'querystring'

import {dateString, signRequest} from '../integration/billplz-api.mock'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('billplz-result', () => {
  let app:TestingApp
  let socket:io.Socket
  let originalAmount:number
  let billPlzId:string

  beforeAll(async() => {
    app = await runTestingApp()
    const addressInfo = app.server.address() as websocket.AddressInfo
    socket = io.connect(`http://[${addressInfo.address}]:${addressInfo.port}`, {
      transports: ['websocket']
    })
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', resolve)
      socket.on('connect_error', reject)
    })
  })
  afterAll(async() => {
    socket.disconnect()
    await destroyTestingApp(app)
  })

  it('should create a valid billplz attempt first', async() => {
    const {body:topUpBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestTopUp(
            type: "billplz",
            amount: 100
          ) {
            billPlzId
            amount
            url
          }
        }
      `)
      .expect(200)
    const {body:profileBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayProfile {
            id
            walletBalance
          }
        }
      `)
      .expect(200)

    billPlzId = topUpBody?.data.requestTopUp.billPlzId
    originalAmount = profileBody?.data.displayProfile.walletBalance
  })

  it('should return error if signature is invalid', async() => {
    const {body} = await requires(app.server)
      .post('/billplz-result')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(querystring.stringify({
        id: billPlzId,
        collection_id: 'b7ssrir_',
        paid: 'true',
        state: 'paid',
        amount: '10000',
        paid_amount: '10000',
        due_at: dateString(new Date()),
        email: 'chingyawhao14@gmail.com',
        mobile: '',
        name: 'CHING YAW HAO',
        url: `https://www.billplz.com/bills/${billPlzId}`,
        paid_at: new Date().toISOString()
      }))
      .expect(200)

    expect(body?.errors).toContain(
      'Request is unauthorized'
    )
  })

  it("should return error if bill isn't found", async() => {
    const billPlzId = '8X0Iyzaw'
    const {body} = await requires(app.server)
      .post('/billplz-result')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(querystring.stringify(signRequest({
        id: billPlzId,
        collection_id: 'b7ssrir_',
        paid: 'true',
        state: 'paid',
        amount: '10000',
        paid_amount: '10000',
        due_at: dateString(new Date()),
        email: 'chingyawhao14@gmail.com',
        mobile: '',
        name: 'CHING YAW HAO',
        url: `https://www.billplz.com/bills/${billPlzId}`,
        paid_at: new Date().toISOString()
      })))
      .expect(200)

    expect(body?.errors).toContain(
      'Bill not found'
    )
  })

  it("should top up user's wallet", async() => {
    const listener = jest.fn()
    socket.on('payment-complete', listener)
    const {body:resultBody} = await requires(app.server)
      .post('/billplz-result')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(querystring.stringify(signRequest({
        id: billPlzId,
        collection_id: 'b7ssrir_',
        paid: 'true',
        state: 'paid',
        amount: '10000',
        paid_amount: '10000',
        due_at: dateString(new Date()),
        email: 'chingyawhao14@gmail.com',
        mobile: '',
        name: 'CHING YAW HAO',
        url: `https://www.billplz.com/bills/${billPlzId}`,
        paid_at: new Date().toISOString()
      })))
      .expect(200)
    const {body:profileBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayProfile {
            id
            walletBalance
          }
        }
      `)
      .expect(200)

    expect(resultBody?.success).toBeTruthy()
    expect(profileBody?.data.displayProfile.walletBalance).toEqual(originalAmount + 100)
    expect(listener).toHaveBeenCalledWith({
      userId: profileBody?.data.displayProfile.id,
      paid: true
    })
  })
})