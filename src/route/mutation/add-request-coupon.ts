import {getUserEmployeeRole} from '../../persistence/user'
import {checkIfCouponCodeUsable} from '../../persistence/coupon'
import {Method} from '..'
import resolveRequest from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'addRequestCoupon',
  request: [
    'requestId: String!',
    'coupon: String!'
  ],
  response: 'OrdersRequest!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
      requestPersistence
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
    if(typeof ordersRequest.coupon === 'string') {
      throw new Error('Orders request already attached a coupon')
    }
    const couponUsable = await checkIfCouponCodeUsable(
      utilities, request.coupon, user
    )
    if(!couponUsable) {
      throw new Error('Coupon attached is invalid')
    }

    const updatedRequest = await requestPersistence.updateRequest({
      requestId: ordersRequest.id
    }, {
      requestor: user.id,
      status: 'attach-coupon',
      coupon: request.coupon
    })
    socket.emit('request-updated', {
      requestId: updatedRequest.id.toString()
    })
    return resolveRequest(utilities, user, updatedRequest)
  }
}
type Request = {
  requestId: string
  coupon: string
}
export default method