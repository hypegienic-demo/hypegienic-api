import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {resolveOrder} from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'requestRetrieveStore',
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
      requestPersistence
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
    if(order.status === 'deposited') {
      const openLockerUnit = await lockerPersistence.getLockerUnit({
        lockerUnitId: order.lockerUnitOpened
      })
      const locker = await lockerPersistence.getLocker({
        lockerId: openLockerUnit.locker
      })
      const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
      if(!isLockerOnline) {
        throw new Error('Locker is offline')
      }
      const physicalLockerUnits = await physicalLockerStore.getLockerUnits(locker.name)
      const lockerUnitStatus = physicalLockerUnits[openLockerUnit.number - 1]
      const [updatedOrder] = await Promise.all([
        requestPersistence.updateOrder({
          orderId: parseInt(request.orderId)
        }, {
          type: 'locker',
          status: 'retrieved-store',
          requestor: user.id
        }),
        lockerUnitStatus === 'locked'
          ? physicalLockerStore.setLockerUnit(locker.name, openLockerUnit.number - 1, 'unlocked')
          : undefined
      ])
      socket.emit('order-updated', {
        orderId: updatedOrder.id.toString()
      })
      return resolveOrder(utilities, user, ordersRequest, updatedOrder)
    } else {
      throw new Error("Order isn't in the correct status")
    }
  }
}
type Request = {
  orderId: string
}
export default method