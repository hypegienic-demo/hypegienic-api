import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {resolveOrder} from '../resolve/request'
import {conjuctJoin} from '../../utility/string'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'updateOrderServices',
  request: [
    'orderId: String!',
    'services: [UpdateOrderService!]!'
  ],
  response: 'Order!',
  schema: `
    input UpdateOrderService {
      id: String!
      price: Float
    }
  `,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
      requestPersistence,
      servicePersistence
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
      throw new Error("User haven't register profile yet...")
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
    const services = await servicePersistence.getServices()
    const requestedServices = request.services.flatMap(({id, price}) => {
      const service = services.find(service => service.id === parseInt(id))
      return service? [{service, price}]:[]
    })
    const requestedMainServices = requestedServices.flatMap(({service}) => service.type === 'main'? [service]:[])
    const excludedServices = requestedServices.filter(({service}) => 
      requestedMainServices.some(({exclude}) => exclude.includes(service.id))
    )
    if(excludedServices.length > 0) {
      throw new Error(`Service ${
        conjuctJoin(requestedMainServices.map(service => service.name))
      } cannot add on ${
        conjuctJoin(excludedServices.map(({service}) => service.name))
      }`)
    }
    const variablePricedService = requestedServices.filter(({service}) => service.pricing === 'variable')
    if(!variablePricedService.every(({price}) => typeof price === 'number')) {
      throw new Error(`Service ${
        conjuctJoin(variablePricedService.map(({service}) => service.name))
      } needs to have attached price`)
    }
    const statuses = [
      'opened-locker',
      'deposited',
      'retrieved-store',
      'delivered-store',
    ]
    if(!statuses.includes(order.status)) {
      throw new Error("Order isn't in the correct status")
    } else {
      const updatedOrder = await requestPersistence.updateOrder({
        orderId: order.id
      }, {
        type: order.type,
        status: 'service-updated',
        requestor: user.id,
        services: requestedServices.flatMap(({service, price}) => {
          const assignedPrice = price?? (service.pricing === 'fixed'
            ? service.pricingAmount
            : undefined
          )
          const orderService = order.services.find(orderService =>
            orderService.id === service.id
          )
          return assignedPrice !== undefined
            ? [{
                id: service.id,
                price: assignedPrice,
                done: orderService?.done?? false
              }]
            : []
        })
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
  services: {
    id: string
    price?: number
  }[]
}
export default method