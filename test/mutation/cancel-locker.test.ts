import requires from 'supertest'
import * as io from 'socket.io-client'
import * as websocket from 'ws'

import {PersistedLocker} from '../../src/persistence/locker'
import {PersistedService} from '../../src/persistence/service'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('cancel-locker', () => {
  let app:TestingApp
  let socket:io.Socket
  let lockers:PersistedLocker[]
  let services:PersistedService[]
  let requestedLockerUnit:
    | {
        id: string
        number: number
        locker: {
          name: string
        }
      }
    | undefined

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
    const [
      {body:lockersBody},
      {body:servicesBody}
    ] = await Promise.all([
      requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawhao')
        .field('graphql', `
          query {
            displayLockers {
              id
              name
            }
          }
        `)
        .expect(200),
      requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawhao')
        .field('graphql', `
          query {
            displayServices {
              id
              type
              name
            }
          }
        `)
        .expect(200)
    ])
    lockers = lockersBody.data.displayLockers
    services = servicesBody.data.displayServices
  })
  afterAll(async() => {
    socket.disconnect()
    await destroyTestingApp(app)
  })

  it('should return error if locker unit is invalid', async() => {
    const lockerIds = lockers.map(locker => locker.id)
    let nonLocker = 0
    while(lockerIds.includes(nonLocker)) nonLocker++
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          cancelLocker(
            lockerId: "${nonLocker}"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Locker not found'
    )
  })

  it('should return error for unregistered user', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          cancelLocker(
            lockerId: "${sunwayLocker?.id}"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return error if user did not open a locker previously', async() => {
    socket.emit('locker-online', {lockerName:'Sunway', serialNumber:'00001'})
    await new Promise(resolve => socket.on('locker-online', resolve))
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          cancelLocker(
            lockerId: "${sunwayLocker?.id}"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User didn't requested open locker"
    )
  })

  it('should not cancel an opened locker', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body:lockerUnitBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Nike Huarache",
            serviceIds: ["${cleanService?.id}"]
          ) {
            id
            number
            locker {
              name
            }
          }
        }
      `)
      .expect(200)
    requestedLockerUnit = lockerUnitBody.data.requestLocker
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          cancelLocker(
            lockerId: "${sunwayLocker?.id}"
          )
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Please close the locker unit first'
    )
  })

  it('should cancel a closed locker', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    if(requestedLockerUnit) {
      await app.utilities.physicalLockerStore.setLockerUnit(
        requestedLockerUnit.locker.name,
        requestedLockerUnit.number - 1,
        'locked'
      )
    }
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          cancelLocker(
            lockerId: "${sunwayLocker?.id}"
          )
        }
      `)
      .expect(200)

    expect(body?.data.cancelLocker).toBeTruthy()
  })
})