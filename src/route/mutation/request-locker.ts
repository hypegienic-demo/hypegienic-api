import {Method} from '..'
import {resolveLockerUnit} from '../resolve/locker'
import {checkIfCouponCodeUsable} from '../../persistence/coupon'
import {conjuctJoin} from '../../utility/string'

const method:Method<Request, ReturnType<typeof resolveLockerUnit>> = {
  type: 'mutation',
  title: 'requestLocker',
  request: [
    'lockerId: String!',
    'name: String!',
    'serviceIds: [String!]!',
    'coupon: String'
  ],
  response: 'LockerUnit',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      physicalLockerStore,
      userPersistence,
      lockerPersistence,
      servicePersistence,
      requestPersistence,
      chatbot
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [locker, services, user] = await Promise.all([
      lockerPersistence.getLocker({
        lockerId: parseInt(request.lockerId)
      }),
      servicePersistence.getServices(),
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      })
    ])
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    if(!locker) {
      throw new Error('Locker not found')
    }
    const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
    if(!isLockerOnline) {
      throw new Error('Locker is offline')
    }
    if(request.coupon !== undefined) {
      const couponUsable = await checkIfCouponCodeUsable(
        utilities, request.coupon, user
      )
      if(!couponUsable) {
        throw new Error('Coupon attached is invalid')
      }
    }
    const requestedServices = request.serviceIds.flatMap((id) => {
      const service = services.find(service => service.id === parseInt(id))
      return service? [service]:[]
    })
    const requestedMainServices = requestedServices.flatMap((service) => service.type === 'main'? [service]:[])
    const requestedMainService = requestedMainServices[0]
    if(!requestedMainService) {
      throw new Error('Please include at least 1 main service')
    }
    if(requestedMainServices.length > 1) {
      throw new Error('Please include only 1 main service')
    }
    const excludedService = requestedServices.filter((service) => requestedMainService.exclude.includes(service.id))
    if(excludedService.length > 0) {
      throw new Error(`Service ${
        requestedMainService.name
      } cannot add on ${
        conjuctJoin(excludedService.map((service) => service.name))
      }`)
    }
    const variablePricedService = requestedServices.filter((service) => service.pricing === 'variable')
    if(variablePricedService.length > 0) {
      throw new Error(`Service ${
        conjuctJoin(variablePricedService.map((service) => service.name))
      } is not available on the app`)
    }
    const unlockLocker = await lockerPersistence.queueLocker(locker.id)
    try {
      const [userOpenedOrders, lockerOccupyingOrders, lockerUnits, physicalLockerUnits] = await Promise.all([
        requestPersistence.getOrders({
          type: 'locker',
          ordererId: user.id,
          statuses: ['opened-locker'],
          lastUpdated: new Date(Date.now() - 5 * 60 * 1000)
        }),
        Promise.all([
          requestPersistence.getOrders({
            type: 'locker',
            lockerId: locker.id,
            statuses: ['opened-locker', 'deposited', 'delivered-back']
          }),
          requestPersistence.getOrders({
            type: 'locker',
            lockerId: locker.id,
            statuses: ['retrieved-back'],
            lastUpdated: new Date(Date.now() - 5 * 60 * 1000)
          })
        ]).then(([orders, retrieved]) =>
          [...orders, ...retrieved].flatMap(order => order.type === 'locker'? [order]:[])
        ),
        lockerPersistence.getLockerUnits({
          lockerId: locker.id
        }),
        physicalLockerStore.getLockerUnits(locker.name)
      ])
      if(userOpenedOrders.length > 0) {
        throw new Error('User already requested open locker')
      }
      const availableLockerUnits = lockerUnits.filter(unit =>
        !lockerOccupyingOrders.some(order => {
          switch(order.status) {
          case 'opened-locker': {
            const lockerUnitStatus = physicalLockerUnits[unit.number - 1]
            return order.lockerUnitOpened === unit.id && lockerUnitStatus === 'unlocked'
          }
          case 'deposited':
            return order.lockerUnitOpened === unit.id
          case 'delivered-back':
            return order.lockerUnitDelivered === unit.id
          case 'retrieved-back': {
            const lockerUnitStatus = physicalLockerUnits[unit.number - 1]
            return order.lockerUnitDelivered === unit.id && lockerUnitStatus === 'unlocked'
          }
          default:
            return false
          }
        })
      )
      if(availableLockerUnits.length === 0) {
        await chatbot.sendMessage('notify', {
          embed: {
            title: 'WARN: Locker units unavailable',
            description: `${locker.name} locker units are all occupied`
          }
        })
        throw new Error('Locker units all occupied')
      } else if(availableLockerUnits.length <= 3) {
        await chatbot.sendMessage('notify', {
          embed: {
            title: 'WARN: Locker units running low',
            description: `${locker.name} only have ${availableLockerUnits.length - 1} available locker units left`
          }
        })
      }
      const openLockerUnit = availableLockerUnits.find(lockerUnit =>
        physicalLockerUnits[lockerUnit.number - 1] === 'unlocked'
      ) ?? availableLockerUnits[Math.floor(Math.random() * availableLockerUnits.length)]
      if(!openLockerUnit) {
        throw new Error('Locker unit to be opened not found')
      }
      const lockerUnitStatus = physicalLockerUnits[openLockerUnit.number - 1]
      const {invoiceId, unlock:unlockRequest} = await requestPersistence.createInvoiceId()
      try {
        await Promise.all([
          requestPersistence.createRequest({
            type: 'locker',
            status: 'in-progress',
            invoiceId,
            coupon: request.coupon,
            orderer: user.id,
            orders: [{
              type: 'locker',
              status: 'opened-locker',
              name: request.name,
              lockerUnitOpened: openLockerUnit.id,
              services: requestedServices.flatMap(service =>
                service.pricing === 'fixed'
                  ? [{
                      id: service.id,
                      price: service.pricingAmount,
                      done: false
                    }]
                  : []
              )
            }],
            requestor: user.id
          }),
          lockerUnitStatus === 'locked'
            ? physicalLockerStore.setLockerUnit(locker.name, openLockerUnit.number - 1, 'unlocked')
            : undefined
        ])
        unlockRequest()
        unlockLocker()
        return resolveLockerUnit(utilities, user, openLockerUnit)
      } catch(error) {
        unlockRequest()
        throw error
      }
    } catch(error) {
      unlockLocker()
      throw error
    }
  }
}
type Request = {
  lockerId: string
  name: string
  serviceIds: string[]
  coupon?: string
}
export default method