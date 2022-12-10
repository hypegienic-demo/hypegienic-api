import requires from 'supertest'

import {PersistedUser} from '../../src/persistence/user'
import {PersistedStore} from '../../src/persistence/store'
import {PersistedService} from '../../src/persistence/service'
import {PersistedOrdersRequest} from '../../src/persistence/request'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('update-order-services', () => {
  let app:TestingApp
  let users:PersistedUser[]
  let stores:PersistedStore[]
  let services:PersistedService[]
  let orderId:string

  beforeAll(async() => {
    app = await runTestingApp()
    const [
      {body:usersBody},
      {body:storesBody},
      {body:servicesBody}
    ] = await Promise.all([
      requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawhao')
        .field('graphql', `
          query {
            displayUsers {
              id
              displayName
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
            displayStores {
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
    users = usersBody.data.displayUsers
    stores = storesBody.data.displayStores
    services = servicesBody.data.displayServices
  })
  afterAll(async() => {
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
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateOrderServices(
            orderId: "${nonOrder}",
            services: [{
              id: "${cleanService?.id}"
            }]
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

  it('should return error if unregistered user', async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const soleProtectService = services.find(service => service.type === 'main' && service.name === 'Sole protect')
    const {body:requestBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addRequest(
            ordererId: "${chingyawjin?.id}",
            storeId: "${hypeguardian?.id}",
            products: [],
            orders: [{
              name: "Nike Huarache",
              services: [{
                id: "${soleProtectService?.id}",
                price: 100
              }]
            }]
          ) {
            id
            orders {
              id
            }
          }
        }
      `)
      .expect(200)
    orderId = requestBody.data?.addRequest?.orders[0]?.id
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          updateOrderServices(
            orderId: "${orderId}",
            services: [{
              id: "${cleanService?.id}"
            }]
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
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          updateOrderServices(
            orderId: "${orderId}",
            services: [{
              id: "${cleanService?.id}"
            }]
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

  it("should return error if there's mutual exclusive services", async() => {
    const mainService = services.find(service => service.type === 'main' && service.name === 'Sole protect')
    const additionalService = services.find(service => service.type === 'additional' && service.name === 'Sole protect')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateOrderServices(
            orderId: "${orderId}",
            services: [{
              id: "${mainService?.id}"
            }, {
              id: "${additionalService?.id}"
            }]
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Service Sole protect cannot add on Sole protect'
    )
  })

  it("should return error if variable pricing service didn't include a price", async() => {
    const soleProtectService = services.find(service => service.type === 'main' && service.name === 'Sole protect')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateOrderServices(
            orderId: "${orderId}",
            services: [{
              id: "${soleProtectService?.id}"
            }]
          ) {
            id
          }
        }
      `)
      .expect(200)
    
    expect(body?.errors).toContain(
      'Service Sole protect needs to have attached price'
    )
  })

  it('should update ordered services if success', async() => {
    const crispService = services.find(service => service.type === 'main' && service.name === 'Crisp')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateOrderServices(
            orderId: "${orderId}",
            services: [{
              id: "${crispService?.id}"
            }]
          ) {
            id
            services {
              id
              done
              assignedPrice
            }
          }
        }
      `)
      .expect(200)

    expect(body.data.updateOrderServices).toEqual({
      id: expect.stringMatching(/^\d+$/),
      services: [{
        id: `${crispService?.id}`,
        done: false,
        assignedPrice: 69
      }]
    })
  })
})