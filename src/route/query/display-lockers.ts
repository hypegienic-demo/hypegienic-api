import {Method} from '..'
import resolveLocker from '../resolve/locker'

const method:Method<Request, ReturnType<typeof resolveLocker>[]> = {
  type: 'query',
  title: 'displayLockers',
  request: [
    'lockerUnitId: String'
  ],
  response: '[Locker!]',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      lockerPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    const lockers = await lockerPersistence.getLockers()
    if(request.lockerUnitId) {
      const locker = lockers.find(locker =>
        request.lockerUnitId &&
        locker.units.includes(parseInt(request.lockerUnitId))
      )
      if(!locker) {
        throw new Error('Locker not found')
      }
      return [resolveLocker(utilities, user, locker)]
    } else {
      return lockers
        .filter(locker => locker.active)
        .map(locker =>
          resolveLocker(utilities, user, locker)
        )
    }
  }
}
type Request = {
  lockerUnitId?: string
} 
export default method