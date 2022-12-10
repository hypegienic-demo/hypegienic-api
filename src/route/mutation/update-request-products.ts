import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'
import {conjuctJoin} from '../../utility/string'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'updateRequestProducts',
  request: [
    'requestId: String!',
    'products: [UpdateRequestProduct!]!'
  ],
  response: 'OrdersRequest!',
  schema: `
    input UpdateRequestProduct {
      id: String!
      quantity: Int!
      price: Float
    }
  `,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
      requestPersistence,
      productPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [user, ordersRequest] = await Promise.all([
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      }),
      requestPersistence.getRequest({
        requestId: parseInt(request.requestId)
      })
    ])
    if(!user) {
      throw new Error("User haven't register profile yet...")
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    }
    if(!ordersRequest || ordersRequest.type !== 'physical') {
      throw new Error('Orders request not found')
    }
    const products = await productPersistence.getProducts()
    const requestedProducts = request.products.flatMap(({id, quantity, price}) => {
      const product = products.find(product => product.id === parseInt(id))
      return product? [{product, quantity, price}]:[]
    })
    if(
      ordersRequest.products.length === request.products.length &&
      ordersRequest.products.every(product => {
        const requestedProduct = requestedProducts
          .find(({product:requestedProduct}) => requestedProduct.id === product.id)
        return requestedProduct &&
          product.quantity === requestedProduct.quantity &&
          product.price === (requestedProduct.price?? (
            requestedProduct.product?.pricing === 'fixed'
              ? requestedProduct.product.pricingAmount
              : undefined
          ))
      })
    ) {
      return resolveRequest(utilities, user, ordersRequest)
    }
    const variablePricedProducts = requestedProducts.filter(({product}) => product.pricing === 'variable')
    if(!variablePricedProducts.every(({price}) => typeof price === 'number')) {
      throw new Error(`Product ${
        conjuctJoin(variablePricedProducts.map(({product}) => product.name))
      } needs to have attached price`)
    }
    const updatedRequest = await requestPersistence.updateRequest({
      requestId: ordersRequest.id
    }, {
      requestor: user.id,
      status: 'product-updated',
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
      })
    })
    socket.emit('request-updated', {
      requestId: updatedRequest.id.toString()
    })
    return resolveRequest(utilities, user, updatedRequest)
  }
}
type Request = {
  requestId: string
  products: {
    id: string
    quantity: number
    price?: number
  }[]
}
export default method