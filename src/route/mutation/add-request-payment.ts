import {PersistedLockerOrder, PersistedPhysicalOrder} from '../../persistence/request'
import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'addRequestPayment',
  request: [
    'requestId: String!',
    'payment: AddRequestPayment!'
  ],
  response: 'OrdersRequest!',
  schema: `
    input AddRequestPayment {
      type: String!
      amount: Float!
      reference: String
      time: String
    }
  `,
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
      throw new Error('Orders request not found')
    }
    if(!['cash', 'bank-transfer', 'credit-debit-card', 'cheque'].includes(request.payment.type)) {
      throw new Error('Payment type not valid')
    }
    if(['bank-transfer', 'credit-debit-card', 'cheque'].includes(request.payment.type) && !request.payment.reference) {
      throw new Error('Bank related payment requires reference')
    }
    const reduceOrderPrice = (price:number, order:PersistedLockerOrder | PersistedPhysicalOrder) =>
      price + order.services.reduce((price, service) => price + service.price, 0)
    const price = ordersRequest.type === 'physical'
      ? ordersRequest.orders.reduce(reduceOrderPrice, 0) +
        ordersRequest.products.reduce((price, product) => price + product.quantity * product.price, 0)
      : ordersRequest.orders.reduce(reduceOrderPrice, 0)
    const paid = ordersRequest.payments.reduce((paid, payment) => paid + payment.amount, 0)
    if(request.payment.amount + paid > price) {
      throw new Error('Payment amount exceeds the current payable amount')
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

    const time = request.payment.time
      ? new Date(Date.parse(request.payment.time))
      : new Date()
    const updatedRequest = await requestPersistence.updateRequest({
      requestId: ordersRequest.id
    }, {
      requestor: user.id,
      status: 'payment-made',
      payment: request.payment.type === 'cash'
        ? {
            ...request.payment,
            type: request.payment.type,
            time
          }
        : {
            ...request.payment,
            reference: request.payment.reference?? '',
            time
          }
    })
    const payment = updatedRequest.payments.find(payment =>
      payment.time.getTime() === time.getTime()
    )
    await blockPersistence.createBlock({
      type: 'top-up',
      amount: request.payment.amount,
      payment: payment?.id,
      time: new Date(),
      to: {
        type: 'store',
        balance: ['bank-transfer', 'credit-debit-card', 'cheque'].includes(request.payment.type)
          ? 'bank'
          : 'cash',
        store: storeId
      }
    })
    socket.emit('request-updated', {
      requestId: updatedRequest.id.toString()
    })
    socket.emit('block-added')
    return resolveRequest(utilities, user, updatedRequest)
  }
}
type Request = {
  requestId: string
  payment: {
    type: 'cash' | 'bank-transfer' | 'credit-debit-card' | 'cheque'
    amount: number
    reference?: string
    time?: string
  }
}
export default method