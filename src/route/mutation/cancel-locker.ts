import {Method} from '..'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'cancelLocker',
  request: [
    'lockerId: String!'
  ],
  response: 'Boolean!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      physicalLockerStore,
      userPersistence,
      lockerPersistence,
      requestPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [locker, user] = await Promise.all([
      lockerPersistence.getLocker({
        lockerId: parseInt(request.lockerId)
      }),
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      })
    ])
    if(!locker) {
      throw new Error('Locker not found')
    }
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
    if(!isLockerOnline) {
      throw new Error('Locker is offline')
    }
    const unlock = await lockerPersistence.queueLocker(locker.id)
    try {
      const [userOpenedOrders, physicalLockerUnits] = await Promise.all([
        requestPersistence.getOrders({
          ordererId: user.id,
          lockerId: locker.id,
          statuses: ['opened-locker']
        }).then(orders =>
          orders.flatMap(order => order.status === 'opened-locker'? [order]:[])
        ),
        physicalLockerStore.getLockerUnits(locker.name)
      ])
      const userOpenedOrder = userOpenedOrders[0]
      if(!userOpenedOrder) {
        throw new Error("User didn't requested open locker")
      }
      const lockerUnit = await lockerPersistence.getLockerUnit({
        lockerUnitId: userOpenedOrder.lockerUnitOpened
      })
      const lockerUnitStatus = physicalLockerUnits[lockerUnit.number - 1]
      if(lockerUnitStatus === 'unlocked') {
        throw new Error('Please close the locker unit first')
      }
      const updatedOrder = await requestPersistence.updateOrder({
        orderId: userOpenedOrder.id
      }, {
        type: 'locker',
        status: 'cancelled',
        requestor: user.id
      })
      unlock()
      socket.emit('order-updated', {
        orderId: updatedOrder.id.toString()
      })
      return true
    } catch(error) {
      unlock()
      throw error
    }
  }
}
type Request = {
  lockerId: string
}
export default method