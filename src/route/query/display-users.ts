import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveUser from '../resolve/user'

const method:Method<Request, ReturnType<typeof resolveUser>[]> = {
  type: 'query',
  title: 'displayUsers',
  request: [
    `userId: String`
  ],
  response: '[User!]!',
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
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    } else if(request.userId) {
      const user = await userPersistence.getUser({
        userId: parseInt(request.userId)
      })
      return [resolveUser(utilities, user)]
    } else {
      const users = await userPersistence.getUsers()
      return users.map(user =>
        resolveUser(utilities, user)
      )
    }
  }
}
type Request = {
  userId?: string
} 
export default method