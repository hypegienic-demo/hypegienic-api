import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import resolveUser from '../resolve/user'

const method:Method<Request, ReturnType<typeof resolveUser>> = {
  type: 'mutation',
  title: 'updateProfile',
  request: [
    'userId: String',
    'displayName: String',
    'mobileNumber: String',
    'email: String',
    'address: String'
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
    const [user, mobileUser, emailUser] = await Promise.all([
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      }),
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
    if(!user) {
      throw new Error("User haven't register profile yet...")
    }
    if(request.mobileNumber && !/^\+601(1\d{8}|[02-9]\d{7})$/.test(request.mobileNumber)) {
      throw new Error('Mobile number is not in the correct format')
    } else if(request.email && !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(request.email)) {
      throw new Error('Email address is not in the correct format')
    }
    if(request.userId) {
      if(!getUserEmployeeRole(user)) {
        throw new Error("User isn't authorized")
      } else if(!(request.displayName ?? request.mobileNumber ?? request.email ?? request.address)) {
        throw new Error('Please specify at least one field to be updated')
      } else if(request.mobileNumber && mobileUser) {
        throw new Error('Mobile number is occupied by other users...')
      } else if(request.email && emailUser) {
        throw new Error('Email is occupied by other users...')
      }
      const updatingUser = await userPersistence.getUser({
        userId: parseInt(request.userId)
      })
      if(!updatingUser) {
        throw new Error('Target user not found')
      } else if(updatingUser.firebaseId && (request.mobileNumber ?? request.email)) {
        throw new Error("Firebase user's mobile number or email cannot be updated")
      }
      const updatedUser = await userPersistence.updateUser({
        userId: updatingUser.id
      }, [
        'displayName' as const,
        'mobileNumber' as const,
        'email' as const,
        'address' as const
      ].reduce((profile, key) => 
        request[key]
          ? {...profile, [key]:request[key]}
          : profile,
        {}
      ))
      socket.emit('user-updated', {
        userId: user.id.toString()
      })
      return resolveUser(utilities, updatedUser)
    } else {
      if(!(request.displayName ?? request.email ?? request.address)) {
        throw new Error('Please specify at least one field to be updated')
      } else if(request.email && emailUser && emailUser.uid !== decodedToken.uid) {
        throw new Error('Email is occupied by other users...')
      }
      const [updatedUser] = await Promise.all([
        userPersistence.updateUser({
          firebaseId: decodedToken.uid
        }, [
          'displayName' as const,
          'email' as const,
          'address' as const
        ].reduce((profile, key) => 
          request[key]
            ? {...profile, [key]:request[key]}
            : profile,
          {}
        )),
        request?.email
          ? authenticationStore.updateUser(decodedToken.uid, {
              email: request.email
            })
          : undefined
      ])
      socket.emit('user-updated', {
        userId: user.id.toString()
      })
      return resolveUser(utilities, updatedUser)
    }
  }
}
type Request = {
  userId?: string
  displayName?: string
  mobileNumber?: string
  email?: string
  address?: string
}
export default method