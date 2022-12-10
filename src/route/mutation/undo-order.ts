import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {resolveOrder} from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'undoOrder',
  request: [
    'orderId: String!'
  ],
  response: 'Order!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
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
      : ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
    if(!ordersRequest || !order) {
      throw new Error('Order not found')
    }
    const events = await requestPersistence.getOrderEvents({
      orderId: order.id
    })
    const lastEvent = events
      .filter(event => event.type === 'updated')
      .sort((eventA, eventB) => eventB.time.getTime() - eventA.time.getTime())[0]
    if(!lastEvent) {
      throw new Error('Order cannot be undone')
    }
    const updatedOrder = await requestPersistence.revertOrderEvent(lastEvent.id, user.id)
    socket.emit('order-updated', {
      orderId: updatedOrder.id.toString()
    })
    return resolveOrder(utilities, user, ordersRequest, updatedOrder)
  }
}
interface Request {
  orderId: string
}

export default method