import requires from 'supertest'
import * as querystring from 'querystring'
import fetch from 'node-fetch'
import * as io from 'socket.io-client'
import * as websocket from 'ws'

import {PersistedOrdersRequest, PersistedLockerOrder} from '../../src/persistence/request'
import {PersistedLocker} from '../../src/persistence/locker'
import {PersistedService} from '../../src/persistence/service'
import {dateString, signRequest} from '../integration/billplz-api.mock'
import {runTestingApp, destroyTestingApp, TestingApp} from '..'

describe('request-retrieve', () => {
  let app:TestingApp
  let socket:io.Socket
  let lockers:PersistedLocker[]
  let services:PersistedService[]
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
          displayRequests(
            everyone: true
          ) {
            id
            type
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
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestRetrieveBack(
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

  it('should return error for unregistered user', async() => {
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
    const requestedLockerUnit = lockerUnitBody.data.requestLocker
    await app.utilities.physicalLockerStore.setLockerUnit(
      requestedLockerUnit.locker.name,
      requestedLockerUnit.number - 1,
      'locked'
    )
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
    const {body:depositedBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        query {
          displayRequests(
            statuses: ["deposited"]
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
    const requests:PersistedOrdersRequest[] = depositedBody.data.displayRequests
    order = requests
      .flatMap(request => request.type === 'locker'? request.orders:[])
      .find(order =>
        order.name === 'Nike Huarache'
      )
    await requires(app.server)
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
    await app.utilities.physicalLockerStore.setLockerUnit(
      requestedLockerUnit.locker.name,
      requestedLockerUnit.number - 1,
      'locked'
    )
    const images = await Promise.all([{
      name: 'Spongebob.png',
      url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/SpongeBob_SquarePants_character.svg/1200px-SpongeBob_SquarePants_character.svg.png'
    }, {
      name: 'Patrick.png',
      url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/Patrick_Star.svg/1200px-Patrick_Star.svg.png'
    }].map(async(file) => {
      const buffer = await fetch(file.url, {method:'GET'})
        .then(response => response.buffer())
      return {
        name: file.name,
        buffer
      }
    }))
    const addBeforeImages = requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
    images.forEach(image =>
      addBeforeImages.attach('imagesBefore', image.buffer, image.name)
    )
    addBeforeImages
      .field('graphql', `
        mutation AddBeforeImages($imagesBefore: [Upload!]!) {
          addBeforeImages(
            orderId: "${order?.id}"
            imagesBefore: $imagesBefore
          ) {
            id
          }
        }
      `)
      await addBeforeImages.expect(200)
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateServiceStatus(
            orderId: "${order?.id}"
            servicesDone: [
              ${order?.services.map(service => `"${service.id}"`).join(', ')}
            ]
          ) {
            id
          }
        }
      `)
      .expect(200)
    const addAfterImages = requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
    images.forEach(image =>
      addAfterImages.attach('imagesAfter', image.buffer, image.name)
    )
    addAfterImages
      .field('graphql', `
        mutation AddAfterImages($imagesAfter: [Upload!]!) {
          addAfterImages(
            orderId: "${order?.id}"
            imagesAfter: $imagesAfter
          ) {
            id
          }
        }
      `)
    await addAfterImages.expect(200)
    const {body:deliveredBackBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          deliverBackLocker(
            orderId: "${order?.id}"
          ) {
            id
            status
            name
            lockerUnitDelivered {
              number
              locker {
                name
              }
            }
          }
        }
      `)
      .expect(200)
    const deliveredLockerUnit = deliveredBackBody.data.deliverBackLocker.lockerUnitDelivered
    if(deliveredLockerUnit) {
      await app.utilities.physicalLockerStore.setLockerUnit(
        deliveredLockerUnit.locker.name,
        deliveredLockerUnit.number - 1,
        'locked'
      )
    }
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          requestRetrieveBack(
            orderId: "${order?.id}"
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

  it('should return error if not request owner', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestRetrieveBack(
            orderId: "${order?.id}"
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
      'Order not found'
    )
  })

  it('should return error if not having enough funds', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestRetrieveBack(
            orderId: "${order?.id}"
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
      "User don't have enough funds in the wallet"
    )
  })

  it('should retrieve order and minus requestor funds', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const {body:topUpBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestTopUp(
            type: "billplz",
            amount: 100
          ) {
            billPlzId
            amount
            url
          }
        }
      `)
      .expect(200)
    const billPlzId = topUpBody.data.requestTopUp.billPlzId
    await requires(app.server)
      .post('/billplz-result')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(querystring.stringify(signRequest({
        id: billPlzId,
        collection_id: 'b7ssrir_',
        paid: 'true',
        state: 'paid',
        amount: '10000',
        paid_amount: '10000',
        due_at: dateString(new Date()),
        email: 'simyeelim@outlook.com',
        mobile: '',
        name: 'LIM SIM YEE',
        url: `https://www.billplz.com/bills/${billPlzId}`,
        paid_at: new Date().toISOString()
      })))
      .expect(200)
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestRetrieveBack(
            orderId: "${order?.id}"
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

    expect(body?.data.requestRetrieveBack).toHaveProperty(
      'locker', {
        id: `${sunwayLocker?.id}`,
        name: 'Sunway'
      }
    )
    const physicalLockerUnits = await app.utilities.physicalLockerStore.getLockerUnits(
      body?.data.requestRetrieveBack.locker.name
    )
    expect(physicalLockerUnits[body?.data.requestRetrieveBack.number - 1]).toEqual('unlocked')

    const {body:profileBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        query {
          displayProfile {
            id
            walletBalance
          }
        }
      `)
      .expect(200)

    
    expect(profileBody?.data.displayProfile.walletBalance).toBe(100 - 39)
  })
})