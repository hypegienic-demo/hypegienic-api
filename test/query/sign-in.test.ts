import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('sign-in', () => {
  let app:TestingApp

  beforeAll(async() => {
    app = await runTestingApp()
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should return true for registered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          signIn {
            registered
          }
        }
      `)
      .expect(200)

    expect(body?.data.signIn).toEqual({
      registered: true
    })
  })

  it('should return false for unregistered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        query {
          signIn {
            registered
          }
        }
      `)
      .expect(200)

    expect(body?.data.signIn).toEqual({
      registered: false
    })
  })
})