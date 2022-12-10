import requires from 'supertest'

import {PersistedUser} from '../../src/persistence/user'
import {PersistedStore} from '../../src/persistence/store'
import {PersistedProduct} from '../../src/persistence/product'
import {PersistedOrdersRequest} from '../../src/persistence/request'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('update-request-products', () => {
  let app:TestingApp
  let users:PersistedUser[]
  let stores:PersistedStore[]
  let products:PersistedProduct[]
  let requestId:string

  beforeAll(async() => {
    app = await runTestingApp()
    const [
      {body:usersBody},
      {body:storesBody},
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
    products = productsBody.data.displayProducts
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
    const requestIds = requests.map(request => request.id)
    let nonRequest = 0
    while(requestIds.includes(nonRequest)) nonRequest++
    const shoeBoxProduct = products.find(product => product.name === 'Shoe Box')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateRequestProducts(
            requestId: "${nonRequest}",
            products: [{
              id: "${shoeBoxProduct?.id}",
              quantity: 3
            }]
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Orders request not found'
    )
  })

  it('should return error if unregistered user', async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const shoeBoxProduct = products.find(product => product.name === 'Shoe Box')
    const {body:requestBody} = await requires(app.server)
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
          }
        }
      `)
      .expect(200)
    requestId = requestBody.data?.addRequest?.id
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        mutation {
          updateRequestProducts(
            requestId: "${requestId}"
            products: [{
              id: "${shoeBoxProduct?.id}",
              quantity: 1
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
    const shoeBoxProduct = products.find(product => product.name === 'Shoe Box')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'limsimyee')
      .field('graphql', `
        mutation {
          updateRequestProducts(
            requestId: "${requestId}"
            products: [{
              id: "${shoeBoxProduct?.id}",
              quantity: 1
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

  it("should return error if variable pricing product didn't include a price", async() => {
    const shoeBoxProduct = products.find(product => product.name === 'Shoe Box')
    const customShoeBoxProduct = products.find(product => product.name === 'Custom-made Shoe Box')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateRequestProducts(
            requestId: "${requestId}"
            products: [{
              id: "${shoeBoxProduct?.id}",
              quantity: 3
            }, {
              id: "${customShoeBoxProduct?.id}",
              quantity: 1
            }]
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

  it('should update ordered products if success', async() => {
    const shoeBoxProduct = products.find(product => product.name === 'Shoe Box')
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateRequestProducts(
            requestId: "${requestId}"
            products: [{
              id: "${shoeBoxProduct?.id}",
              quantity: 1
            }]
          ) {
            id
            price
            products {
              id
              quantity
            }
          }
        }
      `)
      .expect(200)

    expect(body.data.updateRequestProducts).toEqual({
      id: expect.stringMatching(/^\d+$/),
      price: 49,
      products: [{
        id: `${shoeBoxProduct?.id}`,
        quantity: 1
      }]
    })
  })
})