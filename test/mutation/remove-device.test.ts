import requires from 'supertest'

import MockDevicePersistence from '../persistence/device.mock'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('remove-device', () => {
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
          removeDevice(
            uid: "unique"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register profile yet..."
    )
  })

  it('should return error for strangers', async() => {
    await requires(app.server)
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
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          removeDevice(
            uid: "unique"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Device not found...'
    )
  })

  it('should deactivate device', async() => {
    const {body} = await requires(app.server)
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

    expect(body?.data.removeDevice).toBeTruthy()
    const uniqueDevice = await devicePersistence.getDevice({
      uid: 'unique'
    })
    expect(uniqueDevice.active).toBeFalsy()
  })
})