import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('update-profile', () => {
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
        mutation {
          updateProfile(
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

    expect(body?.errors).toContain(
      "User haven't register profile yet..."
    )
  })

  it('should return error if not updated', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateProfile {
            id
            displayName
            mobileNumber
            email
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Please specify at least one field to be updated'
    )
  })

  it('should return error for occupied email', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateProfile(
            email: "simyeelim@outlook.com"
          ) {
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
      'Email is occupied by other users...'
    )
  })

  it('should update profile', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateProfile(
            displayName: "I'm not Hao"
            email: "chingyawhao@example.com"
          ) {
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
  
    const firebaseUser = await app.utilities.authenticationStore.getUser('chingyawhao')
    expect(firebaseUser.email).toEqual('chingyawhao@example.com')
    expect(body?.data.updateProfile).toEqual({
      id: expect.stringMatching(/^\d+$/),
      firebaseId: 'chingyawhao',
      displayName: "I'm not Hao",
      mobileNumber: '+60129126858',
      email: 'chingyawhao@example.com',
      address: '47, Jalan Budiman 3, Taman Mulia, 56000 Cheras, Kuala Lumpur.'
    })
  })
})