import requires from 'supertest'

import MockDevicePersistence from '../persistence/device.mock'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('add-device', () => {
  let app:TestingApp
  let devicePersistence:MockDevicePersistence

  beforeAll(async() => {
    app = await runTestingApp()
    devicePersistence = app.utilities.devicePersistence
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
          addDevice(
            uid: "unique"
            token: "blah-blah-blah"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register profile yet..."
    )
  })

  it('should update profile', async() => {
    const {body:profileBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayProfile {
            id
          }
        }
      `)
      .expect(200)
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addDevice(
            uid: "unique"
            token: "blah-blah-blah"
          )
        }
      `)
      .expect(200)

    expect(body?.data.addDevice).toBeTruthy()
    const uniqueDevice = await devicePersistence.getDevice({
      uid: 'unique'
    })
    expect(`${uniqueDevice.owner}`).toEqual(
      profileBody.data.displayProfile.id
    )
  })

  it('should remove duplicated device token', async() => {
    const {body:profileBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        query {
          displayProfile {
            id
          }
        }
      `)
      .expect(200)
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          addDevice(
            uid: "unique"
            token: "blah-blah-blah"
          )
        }
      `)
      .expect(200)

    expect(body?.data.addDevice).toBeTruthy()
    const uniqueDevice = await devicePersistence.getDevice({
      uid: 'unique'
    })
    expect(`${uniqueDevice.owner}`).toEqual(
      profileBody.data.displayProfile.id
    )
  })

  it('should reactivate device', async() => {
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          removeDevice(
            uid: "unique"
          )
        }
      `)
      .expect(200)
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          addDevice(
            uid: "unique"
            token: "blah-blah-black-sheep"
          )
        }
      `)
      .expect(200)

    expect(body?.data.addDevice).toBeTruthy()
    const uniqueDevice = await devicePersistence.getDevice({
      uid: 'unique'
    })
    expect(uniqueDevice.active).toBeTruthy()
    expect(uniqueDevice.token).toBe('blah-blah-black-sheep')
  })
})