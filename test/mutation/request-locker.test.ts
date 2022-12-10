import requires from 'supertest'
import * as io from 'socket.io-client'
import * as websocket from 'ws'

import {PersistedLocker} from '../../src/persistence/locker'
import {PersistedService} from '../../src/persistence/service'
import MockRequestPersistence from '../persistence/request.mock'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('request-locker', () => {
  let app:TestingApp
  let socket:io.Socket
  let requestPersistence:MockRequestPersistence
  let lockers:PersistedLocker[]
  let services:PersistedService[]
  let openedLockerUnit:string[] = []

  beforeAll(async() => {
    app = await runTestingApp()
    const addressInfo = app.server.address() as websocket.AddressInfo
    socket = io.connect(`http://[${addressInfo.address}]:${addressInfo.port}`, {
      transports: ['websocket']
    })
    requestPersistence = app.utilities.requestPersistence
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
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${nonLocker}",
            name: "Nike Huarache",
            serviceIds: ["${cleanService?.id}"]
          ) {
            id
            number
            row
            column
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Locker not found'
    )
  })

  it('should return error for unregistered user', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Nike Huarache",
            serviceIds: ["${cleanService?.id}"]
          ) {
            id
            number
            row
            column
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return error if locker is offline', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
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
            row
            column
            locker {
              id
              name
            }
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Locker is offline'
    )
  })

  it('should return error if service is invalid', async() => {
    socket.emit('locker-online', {lockerName:'Sunway', serialNumber:'00001'})
    await new Promise(resolve => socket.on('locker-online', resolve))
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const serviceIds = services.map(service => service.id)
    let nonService = 0
    while(serviceIds.includes(nonService)) nonService++
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Nike Huarache",
            serviceIds: ["${nonService}"]
          ) {
            id
            number
            row
            column
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Please include at least 1 main service'
    )
  })

  it('should return error if include more than 1 main service', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const crispService = services.find(service => service.type === 'main' && service.name === 'Crisp')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Nike Huarache",
            serviceIds: ["${cleanService?.id}", "${crispService?.id}"]
          ) {
            id
            number
            row
            column
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Please include only 1 main service'
    )
  })

  it('should open a locker unit', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
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
            row
            column
            locker {
              id
              name
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.requestLocker).toHaveProperty(
      'locker', {
        id: sunwayLocker?.id,
        name: 'Sunway'
      }
    )
    const physicalLockerUnits = await app.utilities.physicalLockerStore.getLockerUnits(
      body?.data.requestLocker.locker.name
    )
    expect(physicalLockerUnits[body?.data.requestLocker.number - 1]).toEqual('unlocked')
    openedLockerUnit.push(body?.data.requestLocker.id)
  })

  it('should prevent user from opening another locker unit', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
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
            row
            column
            locker {
              id
            }
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'User already requested open locker'
    )
  })

  it('should allow user to open another locker unit after 5 minutes', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    await requestPersistence.fastForwardTime(5)
    const {body} = await requires(app.server)
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
            row
            column
            locker {
              id
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.requestLocker).toHaveProperty(
      'locker', {id:sunwayLocker?.id}
    )
    expect(openedLockerUnit).not.toContain(
      body?.data.requestLocker.id
    )
    openedLockerUnit.push(body?.data.requestLocker.id)
  })

  it('should open a locker unit for multiple services', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const waterRepellentService = services.find(service => service.type === 'additional' && service.name === 'Water repellent treatment')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Adidas Ultra Boost",
            serviceIds: [
              "${cleanService?.id}",
              "${waterRepellentService?.id}"
            ]
          ) {
            id
            number
            row
            column
            locker {
              id
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.requestLocker).toHaveProperty(
      'locker', {id:sunwayLocker?.id}
    )
    expect(openedLockerUnit).not.toContain(
      body?.data.requestLocker.id
    )
    openedLockerUnit.push(body?.data.requestLocker.id)
  })

  it('should return error if all locker units are occupied', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Adidas Originals Superstar",
            serviceIds: ["${cleanService?.id}"]
          ) {
            id
            number
            row
            column
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Locker units all occupied'
    )
  })
})