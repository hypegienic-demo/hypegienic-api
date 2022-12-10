import requires from 'supertest'
import * as io from 'socket.io-client'
import * as websocket from 'ws'

import {PersistedOrdersRequest, PersistedLockerOrder} from '../../src/persistence/request'
import {PersistedLocker} from '../../src/persistence/locker'
import {PersistedService} from '../../src/persistence/service'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('update-service-status', () => {
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
  let order:PersistedLockerOrder | undefined

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

  it('should return error if request not found', async() => {
    const {body:requestsBody} = await requires(app.server)
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
              id
            }
          }
        }
      `)
      .expect(200)
    const requests:PersistedOrdersRequest[] = requestsBody.data.displayRequests
    const orderIds = requests.flatMap(request =>
      request.type === 'locker'
        ? request.orders.map(order => order.id)
        : request.orders.map(order => order.id)
    )
    let nonOrder = 0
    while(orderIds.includes(nonOrder)) nonOrder++
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestRetrieveStore(
            orderId: "${nonOrder}"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Order not found'
    )
  })

  it('should return error if not confirm deposited', async() => {
    socket.emit('locker-online', {lockerName:'Sunway', serialNumber:'00001'})
    await new Promise(resolve => socket.on('locker-online', resolve))
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body:lockerUnitBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
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
    const {body:openedBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        query {
          displayRequests(
            statuses: ["opened-locker"]
          ) {
            id
            type
            orders {
              id
              status
              name
              services {
                id
              }
            }
          }
        }
      `)
      .expect(200)
    const requests:PersistedOrdersRequest[] = openedBody.data.displayRequests
    order = requests
      .flatMap(request => request.type === 'locker'? request.orders:[])
      .find(order =>
        order.name === 'Nike Huarache'
      )
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestRetrieveStore(
            orderId: "${order?.id}"
          ) {
            id
          }
        }
      `)
      .expect(200)
    
    expect(body?.errors).toContain(
      "Order isn't in the correct status"
    )
  })

  it('should return error if unregistered user', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    if(requestedLockerUnit) {
      await app.utilities.physicalLockerStore.setLockerUnit(
        requestedLockerUnit.locker.name,
        requestedLockerUnit.number - 1,
        'locked'
      )
    }
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
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
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          requestRetrieveStore(
            orderId: "${order?.id}"
          ) {
            id
          }
        }
      `)
      .expect(200)
    
    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return error if unauthorized user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestRetrieveStore(
            orderId: "${order?.id}"
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

  it('should return order if success', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestRetrieveStore(
            orderId: "${order?.id}"
          ) {
            id
            status
            name
            services {
              id
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.requestRetrieveStore).toEqual({
      ...order,
      status: 'retrieved-store'
    })
  })
})