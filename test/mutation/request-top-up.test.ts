import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('request-top-up', () => {
  let app:TestingApp
  let billPlzId:string

  beforeAll(async() => {
    app = await runTestingApp()
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should return error for unregistered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
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

    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return error if top up type is invalid', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestTopUp(
            type: "invalid",
            amount: 100
          ) {
            billPlzId
            amount
            url
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Top up request type not supported'
    )
  })

  it('should return a valid billplz attempt', async() => {
    const {body} = await requires(app.server)
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

    expect(body?.data.requestTopUp.billPlzId).toMatch(/^[a-z0-9]+$/i)
    expect(body?.data.requestTopUp.amount).toEqual(100)
    billPlzId = body?.data.requestTopUp.billPlzId
  })

  it('should return the same billplz attempt if same amount', async() => {
    const {body} = await requires(app.server)
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

    expect(body?.data.requestTopUp.billPlzId).toEqual(billPlzId)
    expect(body?.data.requestTopUp.amount).toEqual(100)
  })
})