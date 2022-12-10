import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'

const method:Method<{}, SignInResponse> = {
  type: 'query',
  title: 'signIn',
  request: [],
  response: 'SignInResponse',
  schema: `
    type SignInResponse {
      registered: Boolean!
      detail: SignInResponseDetail
    }
    type SignInResponseDetail {
      displayName: String!
      email: String
      employee: String
    }
  `,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    let user = (
      await userPersistence.getUser({
        firebaseId: decodedToken.uid
      }) ??
      await userPersistence.getUser({
        mobileNumber: decodedToken.phone_number
      })
    )
    return {
      registered: user?.firebaseId === decodedToken.uid? true:false,
      detail: user
        ? {
            displayName: user.displayName,
            email: user.email,
            employee: getUserEmployeeRole(user)
          }
        : undefined
    }
  }
}
type SignInResponse = {
  registered: boolean
  detail?: {
    name?: string
    email?: string
  }
}
export default method