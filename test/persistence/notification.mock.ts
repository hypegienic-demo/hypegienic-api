import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import NotificationStore, {NotificationPersistence, Notification, SentNotification} from '../../src/persistence/notification'
import MockDevicePersistence from './device.mock'

export default class MockNotificationStore extends NotificationStore {
  constructor(persistence: {
    devicePersistence: MockDevicePersistence,
    notificationPersistence: MockNotificationPersistence
  }) {
    super(persistence)
  }

  sendNotification = async(notification:Notification) => {
    const devices = await Promise.all(notification.targets.map(target =>
      this.devicePersistence.getDevices({
        ownerId: target.userId
      })
    )).then(results =>
      results.reduce((devices, result) => [...devices, ...result], [])
    )
    const activeDevices = devices
      .filter(device => device.active)
      .filter((device, index, devices) => devices.findIndex(dev => dev.token === device.token) === index)
    const pushedDevices = activeDevices
      .filter((device, index, devices) => devices.findIndex(dev => dev.token === device.token) === index)
    return await this.notificationPersistence.createNotification({
      ...notification,
      pushed: pushedDevices.map(device => device.id)
    })
  }
}

const notifications:SentNotification[] = []
export class MockNotificationPersistence extends NotificationPersistence {
  initializeData = async(session:Session) => {
    for(const notification of notifications) {
      await session.run(
        `MERGE (n:notification {\n` +
        `  time: datetime(),\n` +
        (Object.keys(notification) as (keyof typeof notification)[])
          .filter(key => !['targets', 'read', 'request'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(notification[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        (notification.type === 'order'
          ? `WITH n\n` +
            `MATCH (o:order)\n` +
            `WHERE ID(o) = ${notification.order}\n` +
            `MERGE (o) <-[:REFER]- (n)\n`
          : '') +
        `WITH n\n` +
        `MATCH (u:user)\n` +
        `WHERE ID(u) IN [${notification.targets.map(target => target.userId).join(', ')}]\n` +
        `MERGE (u) <-[t:TARGET]- (n)\n` +
        `SET t.read = false\n` +
        `WITH n\n` +
        `MATCH (d:device)\n` +
        `WHERE ID(d) IN [${notification.pushed.join(', ')}]\n` +
        `MERGE (d) <-[:PUSHED]- (n)\n` +
        `MERGE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(notification) as (keyof typeof notification)[])
          .filter(key => notification[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(notification[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `MERGE (e) -[:FOR]-> (n)`
      )
    }
  }
}