import {Method} from '..'
import resolveUser from '../resolve/user'

const method:Method<{}, ReturnType<typeof resolveUser>> = {
  type: 'query',
  title: 'displayProfile',
  request: [],
  response: 'User',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register profile yet...")
    } else {
      return resolveUser(utilities, user)
    }
  }
}
export default method