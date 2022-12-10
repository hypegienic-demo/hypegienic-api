import {Route} from '..'

const route:Route<Request, Response> = {
  type: 'post',
  path: '/billplz-result',
  resolver: async(utilities, request) => {
    const {
      socket,
      userPersistence,
      blockPersistence,
      walletPersistence,
      billPlzAPI
    } = utilities
    try {
      if(!billPlzAPI.checkSignatureAuthorized(request)) {
        throw new Error('Request is unauthorized')
      }
      const attempt = await walletPersistence.getBillPlzAttempt({
        billPlzId: request.id
      })
      if(!attempt) {
        throw new Error('Bill not found')
      }
      const user = await userPersistence.getUser({
        userId: attempt.requestor
      })
      if(!user) {
        throw new Error('User not found')
      }
      if(request.paid === 'true') {
        const paidAmount = parseInt(request.paid_amount) / 100
        const billPlzAttempt = await walletPersistence.updateBillPlzAttempt({
          attemptId: attempt.id
        }, {
          paidAmount: attempt.paidAmount + paidAmount
        })
        await blockPersistence.createBlock({
          type: 'top-up',
          amount: paidAmount,
          billPlzAttempt: billPlzAttempt.id,
          time: new Date(),
          to: {
            type: 'user',
            balance: 'payment-gateway',
            user: user.id
          }
        })
        socket.emit('payment-complete', {
          userId: user.id.toString(),
          paid: request.paid === 'true'
        })
        socket.emit('block-added')
      }
      return {
        success: true
      }
    } catch(error) {
      if(error instanceof Error) {
        return {
          success: false,
          errors: [error.message]
        }
      } else {
        return {
          success: false,
          errors: []
        }
      }
    }
  }
}
type Request = {
  id: string
  collection_id: string
  paid: string
  state: string
  amount: string
  paid_amount: string
  due_at: string
  email: string
  mobile: string
  name: string
  url: string
  paid_at: string
  x_signature: string
}
type Response = {
  success: boolean
  errors?: string[]
}

export default route