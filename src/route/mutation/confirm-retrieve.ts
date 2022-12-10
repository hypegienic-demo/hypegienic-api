import {Method} from '..'
import {resolveOrder} from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'confirmRetrieve',
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
    }
    const order = ordersRequest?.type === 'locker'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : ordersRequest?.orders.find(order => order.id === parseInt(request.orderId))
    if(!ordersRequest || !order) {
      throw new Error('Order not found')
    }
    if(order.type === 'locker' && order.status === 'retrieved-back') {
      if(ordersRequest.orderer !== user.id) {
        throw new Error('Order not found')
      }
      const deliverLockerUnit = await lockerPersistence.getLockerUnit({
        lockerUnitId: order.lockerUnitDelivered
      })
      const locker = await lockerPersistence.getLocker({
        lockerId: deliverLockerUnit.locker
      })
      const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
      if(!isLockerOnline) {
        throw new Error('Locker is offline')
      }
      const physicalLockerUnits = await physicalLockerStore.getLockerUnits(locker.name)
      const lockerUnitStatus = physicalLockerUnits[deliverLockerUnit.number - 1]
      if(lockerUnitStatus === 'unlocked') {
        throw new Error('Please close the locker unit first')
      }
      return resolveOrder(utilities, user, ordersRequest, order)
    } else if(order.type === 'physical' && order.status === 'cleaned') {
      const updatedOrder = await requestPersistence.updateOrder({
        orderId: parseInt(request.orderId)
      }, {
        type: 'physical',
        status: 'retrieved-back',
        requestor: user.id
      })
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