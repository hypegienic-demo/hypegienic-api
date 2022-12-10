import requires from 'supertest'
import * as io from 'socket.io-client'
import * as websocket from 'ws'

import {PersistedLocker} from '../../src/persistence/locker'
import {PersistedService} from '../../src/persistence/service'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('display-requests', () => {
  let app:TestingApp
  let socket:io.Socket
  let lockers:PersistedLocker[]
  let services:PersistedService[]

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

  it('should return error for unregistered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        query {
          displayRequests {
            id
            type
            orderer {
              displayName
            }
            orders {
              status
              name
              services {
                name
              }
              lockerUnitOpened {
                locker {
                  name
                }
              }
              lockerUnitDelivered {
                locker {
                  name
                }
              }
            }
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return order requests', async() => {
    socket.emit('locker-online', {lockerName:'Sunway', serialNumber:'00001'})
    await new Promise(resolve => socket.on('locker-online', resolve))
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
    await app.utilities.physicalLockerStore.setLockerUnit(
      lockerUnitBody.data.requestLocker.locker.name,
      lockerUnitBody.data.requestLocker.number - 1,
      'locked'
    )
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          confirmDeposit(
            lockerId: "${sunwayLocker?.id}"
          )
        }
      `)
      .expect(200)
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayRequests {
            id
            type
            orderer {
              displayName
            }
            orders {
              status
              name
              services {
                name
              }
              lockerUnitOpened {
                locker {
                  name
                }
              }
              lockerUnitDelivered {
                locker {
                  name
                }
              }
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.displayRequests).toEqual([{
      id: expect.stringMatching(/^\d+$/),
      type: 'locker',
      orderer: {
        displayName: 'Hao'
      },
      orders: [{
        name: 'Nike Huarache',
        status: 'deposited',
        services: [{
          name: 'Clean'
        }],
        lockerUnitOpened: {
          locker: {
            name: 'Sunway'
          }
        }
      }]
    }])
  })

  it('should return order requests with specified locker', async() => {
    socket.emit('locker-online', {lockerName:'Taylor', serialNumber:'00002'})
    await new Promise(resolve => socket.on('locker-online', resolve))
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const taylorLocker = lockers.find(locker => locker.name === 'Taylor')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${taylorLocker?.id}",
            name: "Adidas Ultra Boost",
            serviceIds: ["${cleanService?.id}"]
          ) {
            id
          }
        }
      `)
      .expect(200)
    const {body:allBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayRequests {
            id
            type
            orderer {
              displayName
            }
            orders {
              status
              name
              services {
                name
              }
              lockerUnitOpened {
                locker {
                  name
                }
              }
              lockerUnitDelivered {
                locker {
                  name
                }
              }
            }
          }
        }
      `)
      .expect(200)
    const {body:sunwayBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayRequests(
            lockerId: "${sunwayLocker?.id}"
          ) {
            id
            type
            orderer {
              displayName
            }
            orders {
              status
              name
              services {
                name
              }
              lockerUnitOpened {
                locker {
                  name
                }
              }
              lockerUnitDelivered {
                locker {
                  name
                }
              }
            }
          }
        }
      `)
      .expect(200)

    expect(allBody?.data.displayRequests).toContainEqual({
      id: expect.stringMatching(/^\d+$/),
      type: 'locker',
      orderer: {
        displayName: 'Hao'
      },
      orders: [{
        name: 'Adidas Ultra Boost',
        status: 'opened-locker',
        services: [{
          name: 'Clean'
        }],
        lockerUnitOpened: {
          locker: {
            name: 'Taylor'
          }
        }
      }]
    })
    expect(sunwayBody?.data.displayRequests).toEqual([{
      id: expect.stringMatching(/^\d+$/),
      type: 'locker',
      orderer: {
        displayName: 'Hao'
      },
      orders: [{
        name: 'Nike Huarache',
        status: 'deposited',
        services: [{
          name: 'Clean'
        }],
        lockerUnitOpened: {
          locker: {
            name: 'Sunway'
          }
        }
      }]
    }])
  })

  it('should return order requests with specified status', async() => {
    const {body:allBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayRequests {
            id
            type
            orderer {
              displayName
            }
            orders {
              status
              name
              services {
                name
              }
              lockerUnitOpened {
                locker {
                  name
                }
              }
              lockerUnitDelivered {
                locker {
                  name
                }
              }
            }
          }
        }
      `)
      .expect(200)
    const {body:depositedBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayRequests(
            statuses: ["deposited"]
          ) {
            id
            type
            orderer {
              displayName
            }
            orders {
              status
              name
              services {
                name
              }
              lockerUnitOpened {
                locker {
                  name
                }
              }
              lockerUnitDelivered {
                locker {
                  name
                }
              }
            }
          }
        }
      `)
      .expect(200)

    expect(allBody?.data.displayRequests).toContainEqual({
      id: expect.stringMatching(/^\d+$/),
      type: 'locker',
      orderer: {
        displayName: 'Hao'
      },
      orders: [{
        name: 'Adidas Ultra Boost',
        status: 'opened-locker',
        services: [{
          name: 'Clean'
        }],
        lockerUnitOpened: {
          locker: {
            name: 'Taylor'
          }
        }
      }]
    })
    expect(depositedBody?.data.displayRequests).toEqual([{
      id: expect.stringMatching(/^\d+$/),
      type: 'locker',
      orderer: {
        displayName: 'Hao'
      },
      orders: [{
        name: 'Nike Huarache',
        status: 'deposited',
        services: [{
          name: 'Clean'
        }],
        lockerUnitOpened: {
          locker: {
            name: 'Sunway'
          }
        }
      }]
    }])
  })
})