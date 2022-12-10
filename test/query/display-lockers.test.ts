import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

describe('display-lockers', () => {
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
          displayLockers {
            id
            name
            latitude
            longitude
            rows
            columns
          }
        }
      `)
      .expect(200)

    expect(body?.errors).toContain(
      "User haven't register yet..."
    )
  })

  it('should return lockers for registered user', async() => {
    const {body} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        query {
          displayLockers {
            id
            name
            latitude
            longitude
            rows
            columns
            units {
              id
              number
              row
              column
            }
          }
        }
      `)
      .expect(200)

    const expectedLockers = [{
      name: 'Sunway',
      latitude: 3.0665402,
      longitude: 101.6002593,
      rows: 3,
      columns: 1,
      units: [{
        number: 1,
        row: 1,
        column: 1
      }, {
        number: 2,
        row: 2,
        column: 1
      }, {
        number: 3,
        row: 3,
        column: 1
      }]
    }, {
      name: 'Taylor',
      latitude: 3.0625881,
      longitude: 101.6168253,
      rows: 3,
      columns: 1,
      units: [{
        number: 1,
        row: 1,
        column: 1
      }, {
        number: 2,
        row: 2,
        column: 1
      }, {
        number: 3,
        row: 3,
        column: 1
      }]
    }].map(locker => ({
      id: expect.stringMatching(/^\d+$/),
      ...locker,
      units: locker.units.map(lockerUnit => ({
        id: expect.stringMatching(/^\d+$/),
        ...lockerUnit
      }))
    }))
    expect(body?.data.displayLockers).toEqual(
      expect.arrayContaining(expectedLockers)
    )
    expect(body?.data.displayLockers.length).toEqual(expectedLockers.length)
  })
})