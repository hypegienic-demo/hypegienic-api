import requires from 'supertest'

import {PersistedUser} from '../../src/persistence/user'
import {PersistedStore} from '../../src/persistence/store'
import {PersistedService} from '../../src/persistence/service'
import {PersistedProduct} from '../../src/persistence/product'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('add-request', () => {
  let app:TestingApp
  let users:PersistedUser[]
  let stores:PersistedStore[]
  let services:PersistedService[]
  let products:PersistedProduct[]

  beforeAll(async() => {
    app = await runTestingApp()
    const [
      {body:usersBody},
      {body:storesBody},
      {body:servicesBody},
      {body:productsBody}
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
        .expect(200),
      requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawhao')
        .field('graphql', `
          query {
            displayProducts {
              id
              name
            }
          }
        `)
        .expect(200)
    ])
    users = usersBody.data.displayUsers
    stores = storesBody.data.displayStores
    services = servicesBody.data.displayServices
    products = productsBody.data.displayProducts
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should return error if unregistered user', async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          addRequest(
            ordererId: "${chingyawjin?.id}",
            storeId: "${hypeguardian?.id}",
            products: [],
            orders: [{
              name: "Nike Huarache",
              services: [{
                id: "${cleanService?.id}"
              }]
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
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          addRequest(
            ordererId: "${chingyawjin?.id}",
            storeId: "${hypeguardian?.id}",
            products: [],
            orders: [{
              name: "Nike Huarache",
              services: [{
                id: "${cleanService?.id}"
              }]
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

  it('should return error if customer not found', async() => {
    const userIds = users.map(user => user.id)
    let nonUser = 0
    while(userIds.includes(nonUser)) nonUser++
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addRequest(
            ordererId: "${nonUser}",
            storeId: "${hypeguardian?.id}",
            products: [],
            orders: [{
              name: "Nike Huarache",
              services: [{
                id: "${cleanService?.id}"
              }]
            }]
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Orderer not found'
    )
  })

  it("should return error if there's mutual exclusive services", async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const mainService = services.find(service => service.type === 'main' && service.name === 'Sole protect')
    const additionalService = services.find(service => service.type === 'additional' && service.name === 'Sole protect')
    const {body} = await requires(app.server)
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
                id: "${mainService?.id}"
              }, {
                id: "${additionalService?.id}"
              }]
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
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const soleProtectService = services.find(service => service.type === 'main' && service.name === 'Sole protect')
    const {body} = await requires(app.server)
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
                id: "${soleProtectService?.id}"
              }]
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

  it("should return error if variable pricing product didn't include a price", async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const customShoeBoxProduct = products.find(product => product.name === 'Custom-made Shoe Box')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addRequest(
            ordererId: "${chingyawjin?.id}",
            storeId: "${hypeguardian?.id}",
            products: [{
              id: "${customShoeBoxProduct?.id}",
              quantity: 1
            }],
            orders: []
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Product Custom-made Shoe Box needs to have attached price'
    )
  })

  it('should return order if success', async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const soleProtectService = services.find(service => service.type === 'main' && service.name === 'Sole protect')
    const {body} = await requires(app.server)
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
                id: "${soleProtectService?.id}"
                price: 100
              }]
            }]
          ) {
            id
            type
            orderer {
              displayName
            }
            price
            orders {
              id
              name
              status
              services {
                name
                done
                assignedPrice
              }
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.addRequest).toEqual({
      id: expect.stringMatching(/^\d+$/),
      type: 'physical',
      orderer: {
        displayName: 'Jin'
      },
      price: 100,
      orders: [{
        id: expect.stringMatching(/^\d+$/),
        name: 'Nike Huarache',
        status: 'deposited',
        services: [{
          name: 'Sole protect',
          done: false,
          assignedPrice: 100
        }]
      }]
    })
  })

  it('should return product if success', async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const shoeBoxProduct = products.find(product => product.name === 'Shoe Box')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          addRequest(
            ordererId: "${chingyawjin?.id}",
            storeId: "${hypeguardian?.id}",
            products: [{
              id: "${shoeBoxProduct?.id}",
              quantity: 3
            }],
            orders: []
          ) {
            id
            type
            orderer {
              displayName
            }
            price
            products {
              name
              quantity
              assignedPrice
            }
          }
        }
      `)
      .expect(200)

    expect(body?.data.addRequest).toEqual({
      id: expect.stringMatching(/^\d+$/),
      type: 'physical',
      orderer: {
        displayName: 'Jin'
      },
      price: 147,
      products: [{
        name: 'Shoe Box',
        quantity: 3,
        assignedPrice: 49
      }]
    })
  })
})