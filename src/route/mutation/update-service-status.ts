import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {resolveOrder} from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'updateServiceStatus',
  request: [
    'orderId: String!',
    'servicesDone: [String!]!'
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
    const order = ordersRequest?.type === 'physical'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : ordersRequest?.type === 'locker'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : undefined
    if(!ordersRequest || !order) {
      throw new Error('Order not found')
    }
    const services = order.services
      .filter(service =>
        !service.done &&
        request.servicesDone.includes(service.id.toString())
      )
      .map(service => service.id)
    if(services.length === 0) {
      throw new Error('Please specify at least one pending service')
    }
    if(order.status !== 'delivered-store') {
      throw new Error("Order isn't in the correct status")
    } else {
      const updatedOrder = await requestPersistence.updateOrder({
        orderId: order.id
      }, {
        type: order.type,
        status: 'service-updated',
        requestor: user.id,
        services: order.services.map(service => ({
          ...service,
          done: services.includes(service.id)
            ? true
            : service.done
        }))
      })
      socket.emit('order-updated', {
        orderId: updatedOrder.id.toString()
      })
      return resolveOrder(utilities, user, ordersRequest, updatedOrder)
    }
  }
}
type Request = {
  orderId: string
  servicesDone: string[]
}
export default method