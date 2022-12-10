import DevicePersistence from './device'
import {FirebaseStore, Persistence, stringify, resolveObject} from './'

class NotificationStore extends FirebaseStore {
  devicePersistence:DevicePersistence
  notificationPersistence:NotificationPersistence
  constructor(utilities: {
    devicePersistence: DevicePersistence
    notificationPersistence: NotificationPersistence
  }) {
    super()
    this.devicePersistence = utilities.devicePersistence
    this.notificationPersistence = utilities.notificationPersistence
  }

  sendNotification = async(notification:Notification) => {
    const devices = await Promise.all(notification.targets.map(target =>
      this.devicePersistence.getDevices({
        ownerId: target.userId
      })
    )).then(results => results.flat())
    const activeDevices = devices
      .filter(device => device.active)
      .filter((device, index, devices) => devices.findIndex(dev => dev.token === device.token) === index)
    const pushedDevices = await Promise.all(activeDevices
      .map(async device => {
        try {
          await this.app.messaging().send({
            token: device.token,
            android: {
              notification: {
                title: notification.title,
                body: notification.body,
                icon: '@drawable/ic_notification'
              },
              priority: 'high'
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: notification.title,
                    body: notification.body,
                  },
                  contentAvailable: true,
                },
              },
            },
            data: (Object.keys(notification) as (keyof typeof notification)[])
              .filter(key => !['title', 'body', 'targets'].includes(key))
              .reduce((data, key) => ({
                ...data,
                [key]: notification[key]?.toString()
              }), {}),
          })
          return device
        } catch(error) {
          console.error(error)
          return undefined
        }
      }))
      .then(devices => devices.flatMap(device => device? [device]:[]))
    return await this.notificationPersistence.createNotification({
      ...notification,
      pushed: pushedDevices.map(device => device.id)
    })
  }
}
export class NotificationPersistence extends Persistence {
  createNotification = (notification:SentNotification):Promise<PersistedNotification> => {
    return this.execute(
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
      `MERGE (e) -[:FOR]-> (n)\n` +
      `WITH n\n` +
      `OPTIONAL MATCH (n) -[t:TARGET]-> (u:user)\n` +
      `OPTIONAL MATCH (n) -[:PUSHED]-> (d:device)\n` +
      `OPTIONAL MATCH (n) -[:REFER]-> (order:order)\n` +
      `RETURN n, COLLECT(d) AS pushed, order,\n` +
      `COLLECT({\n` +
      `  userId: u,\n` +
      `  read: t.read\n` +
      `}) AS targets`
    ).then(result => 
      resolveObject(result.records[0] as any)
    )
  }
  updateNotification = (
    where: {
      notificationId?: number
      orderId?: number
    },
    notification: {
      read: number[]
    }
  ):Promise<PersistedNotification> => {
    let query:string = ''
    if(where.notificationId !== undefined) query += `WHERE ID(n) = ${where.notificationId}\n`
    if(where.orderId !== undefined) query +=
      `WITH n\n` +
      `MATCH (n) -[:REFER]-> (r:order)\n` +
      `WHERE ID(r) = ${where.orderId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (n:notification)\n` +
        query +
        `WITH n\n` +
        `OPTIONAL MATCH (n) -[t:TARGET]-> (u:user)\n` +
        `WHERE NOT ID(u) IN [${notification.read.join(', ')}]\n` +
        `SET t.read = false\n` +
        `WITH n\n` +
        `OPTIONAL MATCH (n) -[t:TARGET]-> (u:user)\n` +
        `WHERE ID(u) IN [${notification.read.join(', ')}]\n` +
        `SET t.read = true\n` +
        `MERGE (e:event {\n` +
        `  type: "updated",\n` +
        `  time: datetime(),\n` +
        (Object.keys(notification) as (keyof typeof notification)[])
          .filter(key => notification[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(notification[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `MERGE (e) -[:FOR]-> (n)\n` +
        `WITH n\n` +
        `OPTIONAL MATCH (n) -[t:TARGET]-> (u:user)\n` +
        `OPTIONAL MATCH (n) -[:PUSHED]-> (d:device)\n` +
        `OPTIONAL MATCH (n) -[:REFER]-> (order:order)\n` +
        `RETURN n, COLLECT(d) AS pushed, order,\n` +
        `COLLECT({\n` +
        `  userId: u,\n` +
        `  read: t.read\n` +
        `}) AS targets`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing notification query parameter')
    }
  }
  getNotifications = (where: {
    requestId?: number
    orderId?: number
    targetId?: number
  }):Promise<PersistedNotification[]> => {
    let query:string = ''
    if(where.requestId !== undefined) query +=
      `MATCH (n) -[:REFER]-> (:order) <-[:CONTAIN]- (r:request)\n` +
      `WHERE ID(r) = ${where.requestId}\n`
    if(where.orderId !== undefined) query +=
      `MATCH (n) -[:REFER]-> (o:order)\n` +
      `WHERE ID(o) = ${where.orderId}\n`
    if(where.targetId !== undefined) query +=
      `MATCH (n) -[:TARGET]-> (u:user)\n` +
      `WHERE ID(u) = ${where.targetId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (n:notification)\n` +
        query +
        `WITH n\n` +
        `OPTIONAL MATCH (n) -[t:TARGET]-> (u:user)\n` +
        `OPTIONAL MATCH (n) -[:PUSHED]-> (d:device)\n` +
        `OPTIONAL MATCH (n) -[:REFER]-> (order:order)\n` +
        `RETURN n, COLLECT(d) AS pushed, order,\n` +
        `COLLECT({\n` +
        `  userId: u,\n` +
        `  read: t.read\n` +
        `}) AS targets`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing notification query parameter')
    }
  }
}
export type Notification = {
  title: string
  body: string
  targets: {
    userId: number
    read: boolean
  }[]
} & (
  | {
      type: 'order'
      order: number
    }
)
export type SentNotification = Notification & {
  pushed: number[]
}
export type PersistedNotification = SentNotification & {
  id: number
}
export default NotificationStore