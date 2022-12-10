import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveUser from '../resolve/user'

const method:Method<Request, ReturnType<typeof resolveUser>> = {
  type: 'mutation',
  title: 'addUser',
  request: [
    'displayName: String!',
    'mobileNumber: String!',
    'email: String!',
    'address: String'
  ],
  response: 'User!',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
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
    }

    if(!/^\+601(1\d{8}|[02-9]\d{7})$/.test(request.mobileNumber)) {
      throw new Error('Mobile number is not in the correct format')
    } else if(!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(request.email)) {
      throw new Error('Email address is not in the correct format')
    }

    const [mobileOwner, emailOwner] = await Promise.all([
      (async() => {
        try {
          if(!request.mobileNumber) throw new Error('Mobile number not found...')
          return await authenticationStore.getUserByMobileNumber(request.mobileNumber)
        } catch(error) {
          return undefined
        }
      })(),
      (async() => {
        try {
          if(!request.email) throw new Error('Email not found...')
          return await authenticationStore.getUserByEmail(request.email)
        } catch(error) {
          return undefined
        }
      })()
    ])
    if(mobileOwner || emailOwner) {
      throw new Error('User already exist')
    }

    const persistedUser = await userPersistence.createUser({
      ...request,
      identities: []
    })
    socket.emit('user-added', {
      userId: persistedUser.id.toString()
    })
    return resolveUser(utilities, persistedUser)
  }
}
type Request = {
  displayName: string
  mobileNumber: string
  email: string
  address?: string
}
export default method