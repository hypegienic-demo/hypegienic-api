import {Method} from '..'
import {checkIfCouponCodeUsable} from '../../persistence/coupon'
import {conjuctJoin} from '../../utility/string'
import {resolveServicePreviewOrdered} from '../resolve/service'

const method:Method<Request, ReturnType<typeof resolveServicePreviewOrdered>[]> = {
  type: 'query',
  title: 'previewDiscountedServices',
  request: [
    'services: [PreviewDiscountedService!]!',
    'coupon: String!'
  ],
  response: '[ServicePreviewOrdered!]',
  schema: `
    input PreviewDiscountedService {
      id: String!
      price: Float
    }
  `,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      servicePersistence,
      couponPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }

    const services = await servicePersistence.getServices()
    const requestedServices = request.services.flatMap(({id, price}) => {
      const service = services.find(service => service.id === parseInt(id))
      return service? [{service, price}]:[]
    })
    const variablePricedServices = requestedServices.filter(({service}) => service.pricing === 'variable')
    if(!variablePricedServices.every(({price}) => typeof price === 'number')) {
      throw new Error(`Service ${
        conjuctJoin(variablePricedServices.map(({service}) => service.name))
      } needs to have attached price`)
    }

    const [couponUsable, coupon] = await Promise.all([
      checkIfCouponCodeUsable(
        utilities, request.coupon, user
      ),
      couponPersistence.getCoupon({code:request.coupon})
    ])
    if(!coupon || !couponUsable) {
      throw new Error('Coupon attached is invalid')
    }
    
    return requestedServices
      .flatMap(({service, price}) => {
        const assignedPrice = price?? (service.pricing === 'fixed'
          ? service.pricingAmount
          : undefined
        )
        return assignedPrice !== undefined
          ? [{
              ...service,
              price: assignedPrice,
            }]
          : []
      })
      .map(service =>
        resolveServicePreviewOrdered(utilities, user, service, coupon)
      )
  }
}
type Request = {
  services: {
    id: string
    price?: number
  }[]
  coupon: string
}
export default method