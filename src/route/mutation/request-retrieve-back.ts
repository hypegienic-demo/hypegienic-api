import {calculateOrdersRequestPrice} from '../../persistence/request'
import {resolveLockerUnit} from '../resolve/locker'
import {Method} from '..'

const method:Method<Request, ReturnType<typeof resolveLockerUnit>> = {
  type: 'mutation',
  title: 'requestRetrieveBack',
  request: [
    'orderId: String!'
  ],
  response: 'LockerUnit',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      physicalLockerStore,
      userPersistence,
      lockerPersistence,
      requestPersistence,
      blockPersistence
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
    }
    const order = ordersRequest?.type === 'locker'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : undefined
    if(!ordersRequest || !order || ordersRequest.orderer !== user.id) {
      throw new Error('Order not found')
    }
    if(order.status === 'delivered-back') {
      const [deliverLockerUnit, walletAmount] = await Promise.all([
        lockerPersistence.getLockerUnit({
          lockerUnitId: order.lockerUnitDelivered
        }),
        blockPersistence.getCurrentAmount({
          type: 'user',
          balance: 'payment-gateway',
          user: user.id
        })
      ])
      const price = await calculateOrdersRequestPrice(utilities, ordersRequest)
      const paid = ordersRequest.payments.reduce((paid, payment) => paid + payment.amount, 0)
      const outstanding = price - paid
      if(outstanding > walletAmount) {
        throw new Error("User don't have enough funds in the wallet")
      }
      const locker = await lockerPersistence.getLocker({
        lockerId: deliverLockerUnit.locker
      })
      const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
      if(!isLockerOnline) {
        throw new Error('Locker is offline')
      }
      const physicalLockerUnits = await physicalLockerStore.getLockerUnits(locker.name)
      const lockerUnitStatus = physicalLockerUnits[deliverLockerUnit.number - 1]
      const time = new Date()
      const updatedRequest = await requestPersistence.updateRequest({
        requestId: ordersRequest.id
      }, {
        requestor: user.id,
        status: 'payment-made',
        payment: {
          type: 'payment-gateway',
          amount: outstanding,
          time
        }
      })
      const payment = updatedRequest.payments.find(payment =>
        payment.time.getTime() === time.getTime()
      )
      const [updatedOrder] = await Promise.all([
        requestPersistence.updateOrder({
          orderId: parseInt(request.orderId)
        }, {
          type: 'locker',
          status: 'retrieved-back',
          requestor: user.id
        }),
        blockPersistence.createBlock({
          type: 'transfer',
          amount: outstanding,
          payment: payment?.id,
          time,
          from: {
            type: 'user',
            balance: 'payment-gateway',
            user: user.id
          },
          to: {
            type: 'store',
            balance: 'payment-gateway',
            store: locker.store
          }
        }),
        lockerUnitStatus === 'locked'
          ? physicalLockerStore.setLockerUnit(locker.name, deliverLockerUnit.number - 1, 'unlocked')
          : undefined
      ])
      socket.emit('order-updated', {
        orderId: updatedOrder.id.toString()
      })
      socket.emit('block-added')
      return resolveLockerUnit(utilities, user, deliverLockerUnit)
    } else {
      throw new Error("Order isn't in the correct status")
    }
  }
}
type Request = {
  orderId: string
}
export default method