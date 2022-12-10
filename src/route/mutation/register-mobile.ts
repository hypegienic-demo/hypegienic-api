import {Method} from '..'
import resolveUser from '../resolve/user'

const method:Method<Request, ReturnType<typeof resolveUser>> = {
  type: 'mutation',
  title: 'registerMobile',
  request: [
    'displayName: String!',
    'email: String!'
  ],
  response: 'User',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const existingUser = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(existingUser) {
      throw new Error('User already registered...')
    } else if(!decodedToken.phone_number) {
      throw new Error('Mobile number not found...')
    } else {
      const persistedUser = await userPersistence.getUser({
        mobileNumber: decodedToken.phone_number
      })
      const user = !persistedUser
        ? await userPersistence.createUser({
            firebaseId: decodedToken.uid,
            displayName: request.displayName,
            mobileNumber: decodedToken.phone_number,
            email: request.email,
            identities: []
          })
        : await userPersistence.updateUser({
            mobileNumber: decodedToken.phone_number
          }, {
            firebaseId: decodedToken.uid,
            displayName: request.displayName,
            email: request.email
          })
      socket.emit(!persistedUser? 'user-added':'user-updated', {
        userId: user.id.toString()
      })
      return resolveUser(utilities, user)
    }
  }
}
type Request = {
  displayName: string
  email: string
}
export default method