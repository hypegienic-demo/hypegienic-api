import {getUserEmployeeRole} from '../../persistence/user'
import {resolveLockerUnit} from '../resolve/locker'
import {Method} from '..'

const method:Method<Request, ReturnType<typeof resolveLockerUnit>> = {
  type: 'mutation',
  title: 'openLockerUnit',
  request: [
    'lockerName: String!',
    'lockerUnitNumber: Int!'
  ],
  response: 'LockerUnit',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      physicalLockerStore,
      userPersistence,
      lockerPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [locker, user] = await Promise.all([
      lockerPersistence.getLocker({
        lockerName: request.lockerName
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
    if(!locker) {
      throw new Error('Locker not found')
    }
    const lockerUnits = await lockerPersistence.getLockerUnits({lockerId:locker.id})
    const lockerUnit = lockerUnits.find(lockerUnit => lockerUnit.number === request.lockerUnitNumber)
    if(!lockerUnit) {
      throw new Error('Locker unit not found')
    }
    const isLockerOnline = physicalLockerStore.getIsLockerOnline(locker.name)
    if(!isLockerOnline) {
      throw new Error('Locker is offline')
    }
    const physicalLockerUnits = await physicalLockerStore.getLockerUnits(locker.name)
    const lockerUnitStatus = physicalLockerUnits[request.lockerUnitNumber - 1]
    if(lockerUnitStatus === 'locked') {
      await physicalLockerStore.setLockerUnit(locker.name, request.lockerUnitNumber - 1, 'unlocked')
    }
    return resolveLockerUnit(utilities, user, lockerUnit)
  }
}
type Request = {
  lockerName: string
  lockerUnitNumber: number
}
export default method