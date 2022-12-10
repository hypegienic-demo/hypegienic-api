import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'confirmCloseLocker',
  request: [
    'lockerUnitId: String!'
  ],
  response: 'Boolean!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      physicalLockerStore,
      userPersistence,
      lockerPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [lockerUnit, user] = await Promise.all([
      lockerPersistence.getLockerUnit({
        lockerUnitId: parseInt(request.lockerUnitId)
      }),
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      })
    ])
    if(!user) {
      throw new Error("User haven't register yet...")
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    }
    if(!lockerUnit) {
      throw new Error('Locker unit not found')
    }
    const locker = await lockerPersistence.getLocker({
      lockerId: lockerUnit.locker
    })
    const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
    if(!isLockerOnline) {
      throw new Error('Locker is offline')
    }
    const physicalLockerUnits = await physicalLockerStore.getLockerUnits(locker.name)
    const lockerUnitStatus = physicalLockerUnits[lockerUnit.number - 1]
    if(lockerUnitStatus === 'unlocked') {
      throw new Error('Please close the locker unit first')
    }
    return true
  }
}
type Request = {
  lockerUnitId: string
}
export default method