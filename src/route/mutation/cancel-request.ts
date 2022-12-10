import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'cancelRequest',
  request: [
    'requestId: String!'
  ],
  response: 'OrdersRequest!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
      requestPersistence,
      lockerPersistence,
      blockPersistence
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
    if(!ordersRequest) {
      throw new Error('Order not found')
    }

    const storeId = ordersRequest.type === 'physical'
      ? ordersRequest.store
      : await (async() => {
          const order = ordersRequest.orders[0]
          const locker = await lockerPersistence.getLocker({
            lockerUnitId: order.lockerUnitOpened
          })
          return locker.store
        })()
    const updatedRequest = await requestPersistence.updateRequest({
      requestId: ordersRequest.id
    }, {
      requestor: user.id,
      status: 'request-cancelled'
    })
    const time = new Date()
    for(const payment of updatedRequest.payments) {
      await blockPersistence.createBlock({
        type: 'spent',
        amount: payment.amount,
        payment: payment.id,
        time,
        from: {
          type: 'store',
          balance: ['bank-transfer', 'credit-debit-card', 'cheque'].includes(payment.type)
            ? 'bank'
            : ['payment-gateway'].includes(payment.type)
            ? 'payment-gateway'
            : 'cash',
          store: storeId
        }
      })
    }
    socket.emit('request-updated', {
      requestId: updatedRequest.id.toString()
    })
    socket.emit('block-added')
    return resolveRequest(utilities, user, updatedRequest)
  }
}
type Request = {
  requestId: string
}
export default method