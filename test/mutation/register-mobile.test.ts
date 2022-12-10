import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('register-mobile', () => {
  let app:TestingApp

  beforeAll(async() => {
    app = await runTestingApp()
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should return new user for unregistered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          registerMobile(
            displayName: "Nope"
            email: "notexist@example.com"
          ) {
            id
            displayName
            mobileNumber
            email
          }
        }
      `)
      .expect(200)

    expect(body?.data.registerMobile).toEqual({
      id: expect.stringMatching(/^\d+$/),
      displayName: 'Nope',
      mobileNumber: '+60123456789',
      email: 'notexist@example.com'
    })
  })

  it('should return error for registered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          registerMobile(
            displayName: "Ching Yaw Hao"
            email: "chingyawhao14@gmail.com"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'User already registered...'
    )
  })
})