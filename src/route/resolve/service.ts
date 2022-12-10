import {PersistedUser} from '../../persistence/user'
import {PersistedService} from '../../persistence/service'
import {PersistedCoupon, calculateServiceProductPrice} from '../../persistence/coupon'
import {Utilities} from '../../app'

export const schema = `
  type Service {
    id: String!
    type: String!
    name: String!
    description: String
    price: ServicePrice!
    icon: String
    exclude: [Service!]
  }
  type ServicePrice {
    type: String!
    amount: Float
  }

  type ServiceOrdered {
    id: String!
    type: String!
    name: String!
    description: String
    assignedPrice: Float!
    discountedPrice: Float!
    done: Boolean!
    icon: String
    exclude: [Service!]
  }

  type ServicePreviewOrdered {
    id: String!
    type: String!
    name: String!
    description: String
    assignedPrice: Float!
    discountedPrice: Float!
    icon: String
    exclude: [Service!]
  }
`
const resolveService = async(utilities:Utilities, user:PersistedUser, service:PersistedService) => {
  return {
    ...await resolveServiceCommon(utilities, user, service),
    price: service.pricing === 'fixed'? {
      type: service.pricing,
      amount: service.pricingAmount
    }:{
      type: service.pricing
    },
  }
}
export const resolveServicePreviewOrdered = async(utilities:Utilities,
  user: PersistedUser,
  service: PersistedService & {price:number},
  coupon?: PersistedCoupon
) => {
  return {
    ...await resolveServiceCommon(utilities, user, service),
    assignedPrice: service.price,
    discountedPrice: () => coupon
      ? calculateServiceProductPrice({...service, done:true}, coupon)
      : service.price,
  }
}
export const resolveServiceOrdered = async(utilities:Utilities,
  user: PersistedUser,
  service: PersistedService & {price:number, done:boolean},
  coupon?: PersistedCoupon
) => {
  return {
    ...await resolveServicePreviewOrdered(utilities, user, service, coupon),
    done: service.done
  }
}
const resolveServiceCommon = async(utilities:Utilities, user:PersistedUser, service:PersistedService) => {
  const {
    servicePersistence
  } = utilities
  return {
    id: service.id,
    type: service.type,
    name: service.name,
    description: service.description,
    icon: service.type === 'main'
      ? `/public/${service.icon}.svg`
      : undefined,
    exclude: service.type === 'main'
      ? async() => {
          const excludedServices = await Promise.all(service.exclude.map(exclude =>
            servicePersistence.getService({
              serviceId: exclude
            })
          ))
          return excludedServices.map(service =>
            resolveService(utilities, user, service)
          )
        }
      : undefined
  }
}
export default resolveService