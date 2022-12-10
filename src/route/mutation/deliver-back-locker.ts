import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {resolveOrder} from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'deliverBackLocker',
  request: [
    'orderId: String!'
  ],
  response: 'Order!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      physicalLockerStore,
      userPersistence,
      lockerPersistence,
      requestPersistence,
      notificationStore,
      chatbot
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [ordersRequest, user] = await Promise.all([
      requestPersistence.getRequest({
        orderId: parseInt(request.orderId)
      }),
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      })
    ])
    if(!user) {
      throw new Error("User haven't register yet...")
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    }
    const order = ordersRequest?.type === 'locker'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : undefined
    if(!ordersRequest || !order) {
      throw new Error('Order not found')
    }
    if(order.status === 'cleaned') {
      const locker = await lockerPersistence.getLocker({
        lockerUnitId: order.lockerUnitOpened
      })
      const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
      if(!isLockerOnline) {
        throw new Error('Locker is offline')
      }
      const unlock = await lockerPersistence.queueLocker(locker.id)
      try {
        const [lockerOccupyingOrders, lockerUnits, physicalLockerUnits] = await Promise.all([
          Promise.all([
            requestPersistence.getOrders({
              type: 'locker',
              lockerId: locker.id,
              statuses: ['opened-locker', 'deposited', 'delivered-back']
            }),
            requestPersistence.getOrders({
              type: 'locker',
              lockerId: locker.id,
              statuses: ['retrieved-back'],
              lastUpdated: new Date(Date.now() - 5 * 60 * 1000)
            })
          ]).then(([orders, retrieved]) =>
            [...orders, ...retrieved].flatMap(order => order.type === 'locker'? [order]:[])
          ),
          lockerPersistence.getLockerUnits({
            lockerId: locker.id
          }),
          physicalLockerStore.getLockerUnits(locker.name)
        ])
        const availableLockerUnits = lockerUnits.filter(unit =>
          !lockerOccupyingOrders.some(order => {
            switch(order.status) {
            case 'opened-locker': {
              const lockerUnitStatus = physicalLockerUnits[unit.number - 1]
              return order.lockerUnitOpened === unit.id && lockerUnitStatus === 'unlocked'
            }
            case 'deposited':
              return order.lockerUnitOpened === unit.id
            case 'delivered-back':
              return order.lockerUnitDelivered === unit.id
            case 'retrieved-back': {
              const lockerUnitStatus = physicalLockerUnits[unit.number - 1]
              return order.lockerUnitDelivered === unit.id && lockerUnitStatus === 'unlocked'
            }
            default:
              return false
            }
          })
        )
        if(availableLockerUnits.length === 0) {
          await chatbot.sendMessage('notify', {
            embed: {
              title: 'WARN: Locker units unavailable',
              description: `${locker.name} locker units are all occupied`
            }
          })
          throw new Error('Locker units all occupied')
        } else if(availableLockerUnits.length <= 3) {
          await chatbot.sendMessage('notify', {
            embed: {
              title: 'WARN: Locker units running low',
              description: `${locker.name} only have ${availableLockerUnits.length - 1} available locker units left`
            }
          })
        }
        const openLockerUnit = availableLockerUnits.find(lockerUnit =>
          physicalLockerUnits[lockerUnit.number - 1] === 'unlocked'
        ) ?? availableLockerUnits[Math.floor(Math.random() * availableLockerUnits.length)]
        if(!openLockerUnit) {
          throw new Error('Locker unit to be opened not found')
        }
        const lockerUnitStatus = physicalLockerUnits[openLockerUnit.number - 1]
        const [updatedOrder] = await Promise.all([
          requestPersistence.updateOrder({
            orderId: order.id
          }, {
            type: 'locker',
            status: 'delivered-back',
            requestor: user.id,
            lockerUnitDelivered: openLockerUnit.id
          }),
          lockerUnitStatus === 'locked'
            ? physicalLockerStore.setLockerUnit(locker.name, openLockerUnit.number - 1, 'unlocked')
            : undefined
        ])
        unlock()
        await notificationStore.sendNotification({
          type: 'order',
          order: updatedOrder.id,
          title: 'Your shoes are cleaned!',
          body: `You can retrieve the shoes back from ${locker.name} now...`,
          targets: [{userId:ordersRequest.orderer, read:false}]
        })
        socket.emit('order-updated', {
          orderId: updatedOrder.id.toString()
        })
        return resolveOrder(utilities, user, ordersRequest, updatedOrder)
      } catch(error) {
        unlock()
        throw error
      }
    } else {
      throw new Error("Order isn't in the correct status")
    }
  }
}
type Request = {
  orderId: string
}
export default method