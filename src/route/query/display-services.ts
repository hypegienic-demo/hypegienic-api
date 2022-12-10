import {Method} from '..'
import {PersistedService} from '../../persistence/service'
import resolveService from '../resolve/service'

const method:Method<Request, ReturnType<typeof resolveService>[]> = {
  type: 'query',
  title: 'displayServices',
  request: [
    'priceType: String'
  ],
  response: '[Service!]',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      servicePersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    const services = await servicePersistence.getServices()
    const filteredServices = services
      .filter(service =>
        request.priceType === undefined ||
        service.pricing === request.priceType
      )
    const getServiceTypePoint = (service:PersistedService) =>
      service.type === 'main'? 0:1
    const getServicePricingPoint = (service:PersistedService) =>
      service.pricing === 'variable'? 1:0
    const sortedServices = filteredServices
      .sort((service1, service2) => {
        if(service1.type !== service2.type) {
          return getServiceTypePoint(service1) - getServiceTypePoint(service2)
        } else if(
          service1.pricing === 'variable' ||
          service2.pricing === 'variable'
        ) {
          return getServicePricingPoint(service1) - getServicePricingPoint(service2)
        } else {
          return service1.pricingAmount - service2.pricingAmount
        }
      })
    return sortedServices.map(service =>
      resolveService(utilities, user, service)
    )
  }
}
type Request = {
  priceType?: string
}
export default method