import {PersistedLockerOrder, PersistedPhysicalOrder} from '../../persistence/request'
import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveRequest from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveRequest>[]> = {
  type: 'query',
  title: 'displayRequests',
  request: [
    'requestId: String',
    'orderId: String',
    'lockerId: String',
    'statuses: [String!]',
    'everyone: Boolean'
  ],
  response: '[OrdersRequest!]',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      requestPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    const requestId = request.requestId?? request.orderId
    if(requestId !== undefined) {
      const orderRequest = request.requestId
        ? await requestPersistence.getRequest({
            requestId: parseInt(requestId)
          })
        : await requestPersistence.getRequest({
            orderId: parseInt(requestId)
          })
      const permitted = orderRequest.orderer === user.id || (
        request.everyone && getUserEmployeeRole(user)
      )
      if(!permitted) {
        throw new Error('Your action is not permitted')
      }
      return [resolveRequest(utilities, user, orderRequest)]
    } else if(request.everyone) {
      if(!getUserEmployeeRole(user)) {
        throw new Error('Your action is not permitted')
      }
      const orderRequests = await requestPersistence.getIncompleteRequests()
      return orderRequests.map(orderRequest =>
        resolveRequest(utilities, user, orderRequest)
      )
    } else {
      let openedStatuses = ([
        'opened-locker'
      ] as OrderStatus[]).filter(status =>
        !request.statuses || request.statuses.includes(status)
      )
      let otherStatuses = ([
        'cancelled',
        'deposited',
        'retrieved-store',
        'delivered-store',
        'cleaned',
        'delivered-back',
        'retrieved-back'
      ] as OrderStatus[]).filter(status =>
        !request.statuses || request.statuses.includes(status)
      )
      const orderRequests = await Promise.all([
        openedStatuses.length > 0
          ? requestPersistence.getRequests({
              ordererId: user.id,
              lockerId: request.lockerId
                ? parseInt(request.lockerId)
                : undefined,
              statuses: openedStatuses,
              lastUpdated: new Date(Date.now() - 5 * 60 * 1000)
            })
          : [],
        otherStatuses.length > 0
          ? requestPersistence.getRequests({
              ordererId: user.id,
              lockerId: request.lockerId
                ? parseInt(request.lockerId)
                : undefined,
              statuses: otherStatuses
            })
          : []
      ]).then(([opened, requests]) => [...opened, ...requests])
      return orderRequests
        .filter((request, index, requests) =>
          requests.findIndex(({id}) => request.id === id) === index
        )
        .map(orderRequest =>
          resolveRequest(utilities, user, orderRequest)
        )
    }
  }
}
type Request = {
  requestId?: string
  orderId?: string
  lockerId?: string
  statuses?: OrderStatus[]
  everyone?: boolean
}
type OrderStatus = (PersistedLockerOrder | PersistedPhysicalOrder)['status']
export default method