import requires from 'supertest'
import fetch from 'node-fetch'

import {PersistedUser} from '../../src/persistence/user'
import {PersistedStore} from '../../src/persistence/store'
import {PersistedService} from '../../src/persistence/service'
import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('undo-order', () => {
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

  it('should undo order successfully', async() => {
    const chingyawjin = users.find(user => user.displayName === 'Jin')
    const hypeguardian = stores.find(store => store.name === 'Hype Guardian Sdn Bhd')
    const cleanService = services.find(service => service.type === 'main' && service.name === 'Clean')
    const waterRepellentService = services.find(service => service.type === 'additional' && service.name === 'Water repellent treatment')
    const disinfectantService = services.find(service => service.type === 'additional' && service.name === 'Disinfectant')
    const soleProtectService = services.find(service => service.type === 'additional' && service.name === 'Sole protect')
    const {body:addRequestBody} = await requires(app.server)
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
                id: "${cleanService?.id}"
              }, {
                id: "${waterRepellentService?.id}"
              }, {
                id: "${disinfectantService?.id}"
              }, {
                id: "${soleProtectService?.id}",
                price: 100
              }]
            }]
          ) {
            orders {
              id
            }
          }
        }
      `)
      .expect(200)
    orderId = addRequestBody.data?.addRequest.orders?.[0]?.id
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
            orderId: "${orderId}"
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
            orderId: "${orderId}"
            servicesDone: ["${cleanService?.id}"]
          ) {
            id
          }
        }
      `)
      .expect(200)
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateServiceStatus(
            orderId: "${orderId}"
            servicesDone: ["${waterRepellentService?.id}"]
          ) {
            id
          }
        }
      `)
      .expect(200)
    await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          updateServiceStatus(
            orderId: "${orderId}"
            servicesDone: [
              "${disinfectantService?.id}",
              "${soleProtectService?.id}"
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
            orderId: "${orderId}"
            imagesAfter: $imagesAfter
          ) {
            id
          }
        }
      `)
    await addAfterImages.expect(200)

    const displayOrder = async() => {
      const {body} = await requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawhao')
        .field('graphql', `
          query {
            displayRequests(
              orderId: "${orderId}"
              everyone: true
            ) {
              id
              type
              orders {
                id
                status
                name
                services {
                  id
                  done
                }
                imagesBefore {
                  id
                }
                imagesAfter {
                  id
                }
              }
            }
          }
        `)
        .expect(200)
      return body?.data.displayRequests?.[0].orders
        .find((order:any) => order.id === orderId)
    }
    const undoOrder = async() => {
      await requires(app.server)
        .post('/root')
        .set('Content-Type', 'multipart/graphql')
        .set('Authorization', 'chingyawhao')
        .field('graphql', `
          mutation {
            undoOrder(
              orderId: "${orderId}"
            ) {
              id
            }
          }
        `)
        .expect(200)
    }
    const cleanedOrder = await displayOrder()
    expect(cleanedOrder).toEqual({
      id: expect.stringMatching(/^\d+$/),
      status: 'cleaned',
      name: 'Nike Huarache',
      services: expect.arrayContaining([
        {id:`${cleanService?.id}`, done:true},
        {id:`${waterRepellentService?.id}`, done:true},
        {id:`${disinfectantService?.id}`, done:true},
        {id:`${soleProtectService?.id}`, done:true}
      ]),
      imagesBefore: [
        {id:expect.stringMatching(/^\d+$/)},
        {id:expect.stringMatching(/^\d+$/)}
      ],
      imagesAfter: [
        {id:expect.stringMatching(/^\d+$/)},
        {id:expect.stringMatching(/^\d+$/)}
      ]
    })
    await undoOrder()
    const cleaningOrder1 = await displayOrder()
    expect(cleaningOrder1).toEqual({
      id: expect.stringMatching(/^\d+$/),
      status: 'delivered-store',
      name: 'Nike Huarache',
      services: expect.arrayContaining([
        {id:`${cleanService?.id}`, done:true},
        {id:`${waterRepellentService?.id}`, done:true},
        {id:`${disinfectantService?.id}`, done:true},
        {id:`${soleProtectService?.id}`, done:true}
      ]),
      imagesBefore: [
        {id:expect.stringMatching(/^\d+$/)},
        {id:expect.stringMatching(/^\d+$/)}
      ]
    })
    await undoOrder()
    const cleaningOrder2 = await displayOrder()
    expect(cleaningOrder2).toEqual({
      id: expect.stringMatching(/^\d+$/),
      status: 'delivered-store',
      name: 'Nike Huarache',
      services: expect.arrayContaining([
        {id:`${cleanService?.id}`, done:true},
        {id:`${waterRepellentService?.id}`, done:true},
        {id:`${disinfectantService?.id}`, done:false},
        {id:`${soleProtectService?.id}`, done:false}
      ]),
      imagesBefore: [
        {id:expect.stringMatching(/^\d+$/)},
        {id:expect.stringMatching(/^\d+$/)}
      ]
    })
    await undoOrder()
    const cleaningOrder3 = await displayOrder()
    expect(cleaningOrder3).toEqual({
      id: expect.stringMatching(/^\d+$/),
      status: 'delivered-store',
      name: 'Nike Huarache',
      services: expect.arrayContaining([
        {id:`${cleanService?.id}`, done:true},
        {id:`${waterRepellentService?.id}`, done:false},
        {id:`${disinfectantService?.id}`, done:false},
        {id:`${soleProtectService?.id}`, done:false}
      ]),
      imagesBefore: [
        {id:expect.stringMatching(/^\d+$/)},
        {id:expect.stringMatching(/^\d+$/)}
      ]
    })
    await undoOrder()
    const deliveredStoreOrder = await displayOrder()
    expect(deliveredStoreOrder).toEqual({
      id: expect.stringMatching(/^\d+$/),
      status: 'delivered-store',
      name: 'Nike Huarache',
      services: expect.arrayContaining([
        {id:`${cleanService?.id}`, done:false},
        {id:`${waterRepellentService?.id}`, done:false},
        {id:`${disinfectantService?.id}`, done:false},
        {id:`${soleProtectService?.id}`, done:false}
      ]),
      imagesBefore: [
        {id:expect.stringMatching(/^\d+$/)},
        {id:expect.stringMatching(/^\d+$/)}
      ]
    })
    await undoOrder()
    const depositedOrder = await displayOrder()
    expect(depositedOrder).toEqual({
      id: expect.stringMatching(/^\d+$/),
      status: 'deposited',
      name: 'Nike Huarache',
      services: expect.arrayContaining([
        {id:`${cleanService?.id}`, done:false},
        {id:`${waterRepellentService?.id}`, done:false},
        {id:`${disinfectantService?.id}`, done:false},
        {id:`${soleProtectService?.id}`, done:false}
      ])
    })
  })

  it('should return error if order can no longer be undo', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          undoOrder(
            orderId: "${orderId}"
          ) {
            id
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      'Order cannot be undone'
    )
  })
})