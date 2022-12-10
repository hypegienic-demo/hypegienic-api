import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('display-profile', () => {
  let app:TestingApp

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
        query {
          displayProfile {
            id
            firebaseId
            displayName
            mobileNumber
            email
            address
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register profile yet..."
    )
  })

  it('should return profile for registered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayProfile {
            id
            firebaseId
            displayName
            mobileNumber
            email
            address
          }
        }
      `)
      .expect(200)

    expect(body?.data.displayProfile).toEqual({
      id: expect.stringMatching(/^\d+$/),
      firebaseId: 'chingyawhao',
      displayName: 'Hao',
      mobileNumber: '+60129126858',
      email: 'chingyawhao14@gmail.com',
      address: '47, Jalan Budiman 3, Taman Mulia, 56000 Cheras, Kuala Lumpur.'
    })
  })

  it('should return correct money amount from our blocks', async() => {
    const {body} = await requires(app.server)
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

    expect(body?.data.displayProfile.walletBalance).toEqual(39)
  })
})