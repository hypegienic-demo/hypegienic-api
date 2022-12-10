import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('add-user', () => {
  let app:TestingApp

  beforeAll(async() => {
    app = await runTestingApp()
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should return error if unregistered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+60174068798",
            email: "bryanchye@gmail.com"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register profile yet..."
    )
  })

  it('should return error if unauthorized user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+60174068798",
            email: "bryanchye@gmail.com"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User isn't authorized"
    )
  })

  it('should return error if mobile or email not in a correct format', async() => {
    const {body:body1} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+6017406879",
            email: "bryanchye@gmail.com"
          ) {
            id
          }
        }
      `)
      .expect(200)
    const {body:body2} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+60174068798",
            email: "bryanchye"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body1?.errors).toContain(
      'Mobile number is not in the correct format'
    )
    expect(body2?.errors).toContain(
      'Email address is not in the correct format'
    )
  })

  it('should return error if mobile or email are already occupied', async() => {
    const {body:body1} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+60129126858",
            email: "bryanchye@gmail.com"
          ) {
            id
          }
        }
      `)
      .expect(200)
    const {body:body2} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+60174068798",
            email: "chingyawhao14@gmail.com"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body1?.errors).toContain(
      'User already exist'
    )
    expect(body2?.errors).toContain(
      'User already exist'
    )
  })

  it('should return user if success', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addUser(
            displayName: "Bryan Chye",
            mobileNumber: "+60174068798",
            email: "bryanchye@gmail.com"
          ) {
            id
            displayName
            mobileNumber
            email
          }
        }
      `)
      .expect(200)

    expect(body?.data.addUser).toEqual({
      id: expect.stringMatching(/^\d+$/),
      displayName: 'Bryan Chye',
      mobileNumber: '+60174068798',
      email: 'bryanchye@gmail.com'
    })
  })
})