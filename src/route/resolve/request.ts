import {parse} from '../../persistence'
import {PersistedUser} from '../../persistence/user'
import {
  PersistedOrdersRequest, PersistedLockerOrder, PersistedPhysicalOrder,
  PersistedOrdersRequestEvent, PersistedOrderEvent,
  calculateOrdersRequestPrice
} from '../../persistence/request'
import {Utilities} from '../../app'
import resolveFile from './file'
import {resolveServiceOrdered} from './service'
import {resolveProductOrdered} from './product'
import resolveUser from './user'
import {resolveLockerUnit} from './locker'
import resolveStore from './store'

export const schema = `
  type OrdersRequest {
    id: String!
    type: String!
    time: String!
    status: String!
    invoice: RequestInvoice!
    coupon: String
    orderer: User!
    store: Store!
    payments: [RequestPayment!]!
    price: Float!
    paid: Float!
    products: [ProductOrdered!]!
    pickUpTime: String
    remark: String!
    orders: [Order!]!
  }
  type RequestInvoice {
    time: String!
    number: Int!
  }
  type RequestPayment {
    type: String!
    time: String!
    amount: Float!
    reference: String
  }
  type Order {
    id: String!
    type: String!
    time: String!
    status: String!
    name: String!
    services: [ServiceOrdered!]!
    lockerUnitOpened: LockerUnit
    lockerUnitDelivered: LockerUnit
    imagesBefore: [File!]
    imagesAfter: [File!]
    update: Boolean!
    events: [OrderEvent!]!
  }
  type OrderEvent {
    type: String!
    time: String!
    _name: String
    _type: String
    _status: String
    _lockerUnitOpened: LockerUnit
    _lockerUnitDelivered: LockerUnit
    _services: [ServiceOrdered!]
  }
`
export default async(utilities:Utilities, user:PersistedUser, request:PersistedOrdersRequest) => {
  const {
    userPersistence,
    productPersistence,
    requestPersistence,
    storePersistence,
    lockerPersistence
  } = utilities
  return request
    ? {
        id: request.id,
        type: request.type,
        time: request.time.toISOString(),
        status: request.status,
        invoice: {
          time: async() => {
            const events = await requestPersistence.getRequestEvents({
              requestId: request.id
            })
            const createdEvent = events.find(event => event.type === 'created')
            return createdEvent?.time.toISOString()
          },
          number: request.invoiceId
        },
        coupon: request.coupon,
        orderer: async() => {
          const user = await userPersistence.getUser({
            userId: request.orderer
          })
          return resolveUser(utilities, user)
        },
        store: async() => {
          if(request.type === 'physical') {
            const store = await storePersistence.getStore({
              storeId: request.store
            })
            return resolveStore(utilities, user, store)
          } else {
            const [order] = request.orders
            const locker = await lockerPersistence.getLocker({
              lockerUnitId: order.lockerUnitOpened
            })
            const store = await storePersistence.getStore({
              storeId: locker.store
            })
            return resolveStore(utilities, user, store)
          }
        },
        payments: () => request.payments.map(payment => ({
          type: payment.type,
          time: payment.time.toISOString(),
          amount: payment.amount,
          reference: payment.type === 'bank-transfer' ||
            payment.type === 'credit-debit-card' ||
            payment.type === 'cheque'
            ? payment.reference
            : undefined
        })),
        price: () => {
          return calculateOrdersRequestPrice(utilities, request)
        },
        paid: () => {
          return request.payments.reduce((paid, payment) => paid + payment.amount, 0)
        },
        products: async() => {
          const products = await productPersistence.getProducts()
          return request.type === 'physical'
            ? request.products.flatMap(({id, quantity, price}) => {
                const product = products.find(product => product.id === id)
                return product? [resolveProductOrdered(utilities, user, {
                  ...product,
                  quantity,
                  price
                })]:[]
              })
            : []
        },
        pickUpTime: request.pickUpTime?.toISOString(),
        remark: request.remark,
        orders: () => request.type === 'locker'
          ? request.orders.map(order => resolveOrder(utilities, user, request, order))
          : request.orders.map(order => resolveOrder(utilities, user, request, order))
      }
    : undefined
}
export const resolveOrder = (utilities:Utilities, user:PersistedUser, request:PersistedOrdersRequest, order:PersistedLockerOrder | PersistedPhysicalOrder) => {
  const {
    requestPersistence,
    servicePersistence,
    lockerPersistence,
    couponPersistence,
    filePersistence,
    notificationPersistence
  } = utilities
  return {
    id: order.id,
    type: order.type,
    time: order.time.toISOString(),
    name: order.name,
    status: order.status,
    services: async() => {
      const [services, coupon] = await Promise.all([
        servicePersistence.getServices(),
        request.coupon
          ? await couponPersistence.getCoupon({code:request.coupon})
          : undefined
      ])
      return order.services.flatMap(({id, price, done}) => {
        const service = services.find(service => service.id === id)
        return service? [resolveServiceOrdered(utilities, user, {
          ...service,
          price,
          done
        }, coupon)]:[]
      })
    },
    lockerUnitOpened: async() => {
      if(order.type === 'locker') {
        const lockerUnit = await lockerPersistence.getLockerUnit({
          lockerUnitId: order.lockerUnitOpened
        })
        return resolveLockerUnit(utilities, user, lockerUnit)
      } else {
        return undefined
      }
    },
    lockerUnitDelivered: async() => {
      if(order.type === 'locker') {
        switch(order.status) {
        case 'delivered-back':
        case 'retrieved-back':
          const lockerUnit = await lockerPersistence.getLockerUnit({
            lockerUnitId: order.lockerUnitDelivered
          })
          return resolveLockerUnit(utilities, user, lockerUnit)
        default:
          return undefined
        }
      } else {
        return undefined
      }
    },
    imagesBefore: async() => {
      switch(order.status) {
      case 'delivered-store':
      case 'cleaned':
      case 'delivered-back':
      case 'retrieved-back':
        const imagesBefore = await filePersistence.getFiles({
          fileIds: order.imagesBefore
        })
        return imagesBefore.map(image => resolveFile(utilities, user, image))
      default:
        return undefined
      }
    },
    imagesAfter: async() => {
      switch(order.status) {
      case 'cleaned':
      case 'delivered-back':
      case 'retrieved-back':
        const imagesAfter = await filePersistence.getFiles({
          fileIds: order.imagesAfter
        })
        return imagesAfter.map(image => resolveFile(utilities, user, image))
      default:
        return undefined
      }
    },
    update: async() => {
      const notifications = await notificationPersistence.getNotifications({
        requestId: request.id,
        targetId: user.id
      })
      const unreadNotifications = notifications.filter(notification => {
        const target = notification.targets.find(({userId}) => userId === user.id)
        return !target?.read?? true
      })
      return unreadNotifications.length > 0
    },
    events: async() => {
      const [requestEvents, orderEvents] = await Promise.all([
        requestPersistence.getRequestEvents({
          requestId: request.id
        }),
        requestPersistence.getOrderEvents({
          orderId: order.id
        })
      ])
      const sortedRequestEvents = requestEvents
        .sort((eventA, eventB) => eventA.time.getTime() - eventB.time.getTime())
      const sortedOrderEvents = orderEvents
        .flatMap(event =>
          event.type === 'created' || event.type === 'updated'
            ? [event]
            : []
        )
        .sort((eventA, eventB) => eventA.time.getTime() - eventB.time.getTime())
      const orderSnapshots = sortedOrderEvents
        .map((event, index, relevantEvents) => {
          const orderSnapshot = relevantEvents
            .slice(0, index + 1)
            .reduce<PersistedOrderEvent>(
              (snapshot, event) => ({...snapshot, ...event}),
              {} as any
            )
          const requestSnapshot = sortedRequestEvents
            .filter(event => event.time <= orderSnapshot.time)
            .reduce<PersistedOrdersRequestEvent>(
              (snapshot, event) => ({...snapshot, ...event}),
              {} as any
            )
          return {
            ...orderSnapshot,
            request: requestSnapshot
          }
        })
      return orderSnapshots
        .map(({type, time, request, ...event}) => ({
          type,
          time: time?.toISOString(),
          _name: event._name,
          _type: event._type,
          _status: event._status,
          _lockerUnitOpened: event._lockerUnitOpened
            ? async() => {
                const lockerUnit = await lockerPersistence.getLockerUnit({
                  lockerUnitId: event._lockerUnitOpened
                })
                return resolveLockerUnit(utilities, user, lockerUnit)
              }
            : undefined,
          _lockerUnitDelivered: event._lockerUnitDelivered
            ? async() => {
                const lockerUnit = await lockerPersistence.getLockerUnit({
                  lockerUnitId: event._lockerUnitDelivered
                })
                return resolveLockerUnit(utilities, user, lockerUnit)
              }
            : undefined,
          _services: event._services
            ? async() => {
                const [services, coupon] = await Promise.all([
                  servicePersistence.getServices(),
                  request._coupon
                    ? await couponPersistence.getCoupon({code:request._coupon})
                    : undefined
                ])
                return event._services?.flatMap(stringified => {
                  const {id, price, done} = parse(stringified)
                  const service = services.find(service => service.id === id)
                  return service? [resolveServiceOrdered(utilities, user, {
                    ...service,
                    price,
                    done
                  }, coupon)]:[]
                })
              }
            : undefined
        }))
    }
  }
}