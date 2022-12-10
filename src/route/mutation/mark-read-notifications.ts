import {Method} from '..'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'markReadNotifications',
  request: [
    'type: String!',
    'orderId: String'
  ],
  response: 'Boolean!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      notificationPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register profile yet...")
    } else if(request.type === 'order' && typeof request.orderId === 'string') {
      const notifications = await notificationPersistence.getNotifications({
        orderId: parseInt(request.orderId),
        targetId: user.id,
      })
      const unreadNotifications = notifications.filter(notification => {
        const target = notification.targets.find(({userId}) => userId === user.id)
        return !target?.read?? true
      })
      for(const notification of unreadNotifications) {
        await notificationPersistence.updateNotification({
          notificationId: notification.id,
        }, {
          read: [
            ...notification.targets
              .filter(({read}) => read)
              .map(({userId}) => userId),
            user.id
          ]
        })
      }
      return true
    } else {
      throw new Error('Notification type not found')
    }
  }
}
type Request = {
  type: string
  orderId?: string
}
export default method