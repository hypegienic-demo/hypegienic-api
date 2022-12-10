import * as fs from 'fs'

import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {Upload} from '../upload'
import {resolveOrder} from '../resolve/request'

const method:Method<Request, ReturnType<typeof resolveOrder>> = {
  type: 'mutation',
  title: 'addBeforeImages',
  request: [
    'orderId: String!',
    'imagesBefore: [Upload!]!'
  ],
  response: 'Order!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
      filePersistence,
      requestPersistence,
      spacesAPI
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
      throw new Error("User haven't register profile yet...")
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    }
    const order = ordersRequest?.type === 'physical'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : ordersRequest?.type === 'locker'
      ? ordersRequest.orders.find(order => order.id === parseInt(request.orderId))
      : undefined
    if(!ordersRequest || !order) {
      throw new Error('Order not found')
    }
    if(request.imagesBefore.length === 0) {
      throw new Error('Please attach at least one image')
    }
    if(order.type === 'physical' && order.status !== 'deposited') {
      throw new Error("Order isn't in the correct status")
    } else if(order.type === 'locker' && order.status !== 'retrieved-store') {
      throw new Error("Order isn't in the correct status")
    } else {
      const imagesBefore = await Promise.all(
        request.imagesBefore.map(async(image) => {
          const buffer = await new Promise<Buffer>((resolve, reject) =>
            fs.readFile(image.path, (error, data) => {
              if (error) reject(error)
              else resolve(data)
            })
          )
          const file = await spacesAPI.uploadFile(image.originalFilename, buffer)
          return filePersistence.createFile({
            type: 'spaces',
            ...file
          })
        })
      )
      const updatedOrder = await requestPersistence.updateOrder({
        orderId: order.id
      }, {
        type: order.type,
        status: 'delivered-store',
        requestor: user.id,
        imagesBefore: imagesBefore.map(image => image.id)
      })
      socket.emit('order-updated', {
        orderId: updatedOrder.id.toString()
      })
      return resolveOrder(utilities, user, ordersRequest, updatedOrder)
    }
  }
}
type Request = {
  orderId: string
  imagesBefore: Upload[]
}
export default method