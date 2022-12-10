import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveRequest>> = {
  type: 'mutation',
  title: 'addRequestPickUpTime',
  request: [
    'requestId: String!',
    'time: String!'
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
    const pickUpTime = new Date(Date.parse(request.time))
    if(!(pickUpTime instanceof Date) || isNaN(pickUpTime.getTime())) {
      throw new Error('Pick up time is not valid')
    } else if(pickUpTime.getTime() <= ordersRequest.time.getTime()) {
      throw new Error('Pick up time has to be later than created time')
    }

    const updatedRequest = await requestPersistence.updateRequest({
      requestId: ordersRequest.id
    }, {
      requestor: user.id,
      status: 'pickup-time-updated',
      time: pickUpTime
    })
    socket.emit('request-updated', {
      requestId: updatedRequest.id.toString()
    })
    return resolveRequest(utilities, user, updatedRequest)
  }
}
type Request = {
  requestId: string
  time: string
}
export default method