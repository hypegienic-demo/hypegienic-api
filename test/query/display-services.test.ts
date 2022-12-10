import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('display-services', () => {
  let app:TestingApp

  beforeAll(async() => {
    app = await runTestingApp()
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should return error for unregistered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'not-exist')
      .field('graphql', `
        query {
          displayServices {
            id
            name
            price {
              type
              amount
            }
            icon
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return profile for registered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayServices {
            id
            type
            name
            price {
              type
              amount
            }
            icon
          }
        }
      `)
      .expect(200)

    const expectedServices = [{
      type: 'main',
      name: 'Clean',
      price: {
        type: 'fixed',
        amount: 39
      },
      icon: '/public/clean-shoe.svg'
    }, {
      type: 'main',
      name: 'Crisp',
      price: {
        type: 'fixed',
        amount: 69
      },
      icon: '/public/spray-clean-shoe.svg'
    }, {
      type: 'main',
      name: 'Sole protect',
      price: {
        type: 'variable'
      },
      icon: '/public/spray-clean-shoe.svg'
    }, {
      type: 'additional',
      name: 'Water repellent treatment',
      price: {
        type: 'fixed',
        amount: 15
      }
    }, {
      type: 'additional',
      name: 'Disinfectant',
      price: {
        type: 'fixed',
        amount: 15
      }
    }, {
      type: 'additional',
      name: 'Sole protect',
      price: {
        type: 'variable'
      }
    }].map(service => ({
      id: expect.stringMatching(/^\d+$/),
      ...service
    }))
    expect(body?.data.displayServices).toEqual(
      expect.arrayContaining(expectedServices)
    )
    expect(body?.data.displayServices.length).toEqual(expectedServices.length)
  })
})