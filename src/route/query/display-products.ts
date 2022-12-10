import {Method} from '..'
import resolveProduct from '../resolve/product'

const method:Method<Request, ReturnType<typeof resolveProduct>[]> = {
  type: 'query',
  title: 'displayProducts',
  request: [
    'priceType: String'
  ],
  response: '[Product!]',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      productPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    const products = await productPersistence.getProducts()
    const filteredProducts = products.filter(product =>
      request.priceType === undefined ||
      product.pricing === request.priceType
    )
    return filteredProducts.map(product =>
      resolveProduct(utilities, user, product)
    )
  }
}
type Request = {
  priceType?: string
}
export default method