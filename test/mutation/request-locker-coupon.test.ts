import requires from 'supertest'
import * as querystring from 'querystring'
import fetch from 'node-fetch'
import * as io from 'socket.io-client'
import * as websocket from 'ws'

import {PersistedOrdersRequest} from '../../src/persistence/request'
import {PersistedLocker} from '../../src/persistence/locker'
import {PersistedService} from '../../src/persistence/service'
import {dateString, signRequest} from '../integration/billplz-api.mock'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('request-locker', () => {
  let app:TestingApp
  let socket:io.Socket
  let lockers:PersistedLocker[]
  let services:PersistedService[]
  let requestLockerResponse:any

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

  it('should attach limited coupon correctly', async() => {
    socket.emit('locker-online', {lockerName:'Sunway', serialNumber:'00001'})
    await new Promise(resolve => socket.on('locker-online', resolve))
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const waterRepellentService = services.find(service => service.type === 'additional' && service.name === 'Water repellent treatment')
    requestLockerResponse = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Nike Huarache",
            serviceIds: [
              "${cleanService?.id}",
              "${waterRepellentService?.id}"
            ],
            coupon: "hypegienic-is-cool"
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
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        query {
          displayRequests(
            lockerId: "${sunwayLocker?.id}",
          ) {
            id
            coupon
            price
          }
        }
      `)
      .expect(200)

    const ordersRequest = body?.data.displayRequests[0]
    expect(ordersRequest).toHaveProperty(
      'coupon', 'hypegienic-is-cool'
    )
    expect(ordersRequest).toHaveProperty(
      'price', (39 * 0.5) + (15 * 0.5)
    )
  })

  it('should reject redeemed limited coupon', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const waterRepellentService = services.find(service => service.type === 'additional' && service.name === 'Water repellent treatment')
    const retrieveToStore = async(name:string, requestLockerBody:any) => {
      const requestedLockerUnit = requestLockerBody.data.requestLocker
      await app.utilities.physicalLockerStore.setLockerUnit(
        requestedLockerUnit.locker.name,
        requestedLockerUnit.number - 1,
        'locked'
      )
      await requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawjin')
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
        .set('Authorization', 'chingyawjin')
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
      const order = requests
        .flatMap(request => request.type === 'locker'? request.orders:[])
        .find(order =>
          order.name === name
        )
      await app.utilities.physicalLockerStore.setLockerUnit(
        requestedLockerUnit.locker.name,
        requestedLockerUnit.number - 1,
        'locked'
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
    }
    await retrieveToStore('Nike Huarache', requestLockerResponse.body)
    requestLockerResponse = await requires(app.server)
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
            ],
            coupon: "hypegienic-is-cool"
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
    await retrieveToStore('Adidas Ultra Boost', requestLockerResponse.body)
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Adidas Originals Superstar",
            serviceIds: [
              "${cleanService?.id}",
              "${waterRepellentService?.id}"
            ],
            coupon: "hypegienic-is-cool"
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

    expect(body?.errors).toContain(
      "Coupon attached is invalid"
    )
  })

  it('should reject ineligible coupon', async() => {
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
            name: "Addidas Ultraboost 22",
            serviceIds: [
              "${cleanService?.id}",
              "${waterRepellentService?.id}"
            ],
            coupon: "i-study-no-money"
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

    expect(body?.errors).toContain(
      "Coupon attached is invalid"
    )
  })

  it('should attach student coupon correctly', async() => {
    const sunwayLocker = lockers.find(locker => locker.name === 'Sunway')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const waterRepellentService = services.find(service => service.type === 'additional' && service.name === 'Water repellent treatment')
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "${sunwayLocker?.id}",
            name: "Addidas Ultraboost 22",
            serviceIds: [
              "${cleanService?.id}",
              "${waterRepellentService?.id}"
            ],
            coupon: "i-study-no-money"
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
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        query {
          displayRequests(
            lockerId: "${sunwayLocker?.id}",
          ) {
            id
            coupon
            price
          }
        }
      `)
      .expect(200)

    const ordersRequest = body?.data.displayRequests[0]
    expect(ordersRequest).toHaveProperty(
      'coupon', 'i-study-no-money'
    )
    expect(ordersRequest).toHaveProperty(
      'price', (39 - 10) + (15)
    )
  })

  it('should charge the same amount discounted', async() => {
    const {body:retrievedStoreBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        query {
          displayRequests(
            statuses: ["retrieved-store"]
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
    const requests:PersistedOrdersRequest[] = retrievedStoreBody.data.displayRequests
    const order = requests
      .flatMap(request => request.type === 'locker'? request.orders:[])
      .find(order =>
        order.name === 'Nike Huarache'
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
    const {body:topUpBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
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
        email: 'chingyawjin@gmail.com',
        mobile: '',
        name: 'CHING YAW JIN',
        url: `https://www.billplz.com/bills/${billPlzId}`,
        paid_at: new Date().toISOString()
      })))
      .expect(200)
    const {body:beforeRetrieveBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        query {
          displayProfile {
            id
            walletBalance
          }
        }
      `)
      .expect(200)
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
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
    const {body:afterRetrieveBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawjin')
      .field('graphql', `
        query {
          displayProfile {
            id
            walletBalance
          }
        }
      `)
      .expect(200)

    expect(
      beforeRetrieveBody?.data.displayProfile.walletBalance -
      afterRetrieveBody?.data.displayProfile.walletBalance
    ).toEqual(
      (39 * 0.5) + (15 * 0.5)
    )
  })
})