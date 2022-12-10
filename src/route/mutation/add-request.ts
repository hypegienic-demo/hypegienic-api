import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'
import {conjuctJoin} from '../../utility/string'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'addRequest',
  request: [
    'ordererId: String!',
    'storeId: String!',
    'products: [AddRequestProduct!]!',
    'orders: [AddRequestOrder!]!'
  ],
  response: 'OrdersRequest!',
  schema: `
    input AddRequestProduct {
      id: String!
      quantity: Int!
      price: Float
    }
    input AddRequestOrder {
      name: String!
      services: [AddRequestOrderService!]!
    }
    input AddRequestOrderService {
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
      servicePersistence,
      productPersistence,
      storePersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register profile yet...")
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    }

    const [orderer, services, products, store] = await Promise.all([
      userPersistence.getUser({
        userId: parseInt(request.ordererId)
      }),
      servicePersistence.getServices(),
      productPersistence.getProducts(),
      storePersistence.getStore({
        storeId: parseInt(request.storeId)
      })
    ])
    if(!orderer) {
      throw new Error('Orderer not found')
    }
    if(!store) {
      throw new Error('Store not found')
    }

    const requestedProducts = request.products.flatMap(({id, quantity, price}) => {
      const product = products.find(product => product.id === parseInt(id))
      return product? [{product, quantity, price}]:[]
    })
    const variablePricedProducts = requestedProducts.filter(({product}) => product.pricing === 'variable')
    if(!variablePricedProducts.every(({price}) => typeof price === 'number')) {
      throw new Error(`Product ${
        conjuctJoin(variablePricedProducts.map(({product}) => product.name))
      } needs to have attached price`)
    }

    const orders = request.orders.map(order => {
      const requestedServices = order.services.flatMap(({id, price}) => {
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
      const variablePricedServices = requestedServices.filter(({service}) => service.pricing === 'variable')
      if(!variablePricedServices.every(({price}) => typeof price === 'number')) {
        throw new Error(`Service ${
          conjuctJoin(variablePricedServices.map(({service}) => service.name))
        } needs to have attached price`)
      }

      return {
        type: 'physical' as const,
        status: 'deposited' as const,
        name: order.name,
        services: requestedServices.flatMap(({service, price}) => {
          const assignedPrice = price?? (service.pricing === 'fixed'
            ? service.pricingAmount
            : undefined
          )
          return assignedPrice !== undefined
            ? [{
                id: service.id,
                price: assignedPrice,
                done: false
              }]
            : []
        })
      }
    })

    const {invoiceId, unlock} = await requestPersistence.createInvoiceId()
    try {
      const persistedRequest = await requestPersistence.createRequest({
        type: 'physical',
        status: 'in-progress',
        invoiceId,
        orderer: orderer.id,
        store: store.id,
        products: requestedProducts.flatMap(({product, quantity, price}) => {
          const assignedPrice = price?? (product.pricing === 'fixed'
            ? product.pricingAmount
            : undefined
          )
          return assignedPrice !== undefined
            ? [{
                id: product.id,
                quantity,
                price: assignedPrice
              }]
            : []
        }),
        orders,
        requestor: user.id
      })
      unlock()
      socket.emit('request-added', {
        requestId: persistedRequest.id.toString()
      })
      return resolveRequest(utilities, user, persistedRequest)
    } catch(error) {
      unlock()
      throw error
    }
  }
}
type Request = {
  ordererId: string
  storeId: string
  products: {
    id: string
    quantity: number
    price?: number
  }[]
  orders: {
    name: string
    services: {
      id: string
      price?: number
    }[]
  }[]
}
export default method