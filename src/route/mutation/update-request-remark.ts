import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'updateRequestRemark',
  request: [
    'requestId: String!',
    'remark: String!'
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
    if(ordersRequest.remark === request.remark) {
      return resolveRequest(utilities, user, ordersRequest)
    }

    const updatedRequest = await requestPersistence.updateRequest({
      requestId: ordersRequest.id
    }, {
      requestor: user.id,
      status: 'remark-updated',
      remark: request.remark
    })
    socket.emit('request-updated', {
      requestId: updatedRequest.id.toString()
    })
    return resolveRequest(utilities, user, updatedRequest)
  }
}
type Request = {
  requestId: string
  remark: string
}
export default method