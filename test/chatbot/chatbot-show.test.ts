import requires from 'supertest'

import {runTestingApp, destroyTestingApp, TestingApp} from '../'

declare const DISCORD_SETTING:{prefix:string, server:string}

describe.skip('display-lockers', () => {
  let app:TestingApp
  let requestedLockerUnit:{
    id: string
    number: number
    locker: {
      name: string
    }
  }

  beforeAll(async() => {
    app = await runTestingApp()
  })
  afterAll(async() => {
    await destroyTestingApp(app)
  })

  it('should show all requests', async() => {
    const {body:lockerUnitBody} = await requires(app.server)
      .post('/root')
      .set('Content-Type', 'multipart/graphql')
      .set('Authorization', 'chingyawhao')
      .field('graphql', `
        mutation {
          requestLocker(
            lockerId: "0",
            name: "Nike Huarache",
            serviceIds: ["0"]
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
          confirmDeposit(
            lockerId: "0"
          )
        }
      `)
      .expect(200)

    // app.utilities.chatbot.receiveMessage(`${DISCORD_SETTING.prefix}show`)
    // await new Promise(resolve => setTimeout(resolve, 1000))
    // const lastSentMessage = app.utilities.chatbot.sentMessages.chatbot.slice(-1)[0] as any
    // expect(lastSentMessage?.embed?.description?.includes('Nike Huarache *Hao*'))
    //   .toBeTruthy()
  })
})