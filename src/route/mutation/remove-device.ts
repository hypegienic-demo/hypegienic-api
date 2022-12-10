import {Method} from '..'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'removeDevice',
  request: [
    'uid: String!'
  ],
  response: 'Boolean',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      devicePersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const [user, device] = await Promise.all([
      userPersistence.getUser({
        firebaseId: decodedToken.uid
      }),
      devicePersistence.getDevice({
        uid: request.uid
      })
    ])
    if(!user) {
      throw new Error("User haven't register profile yet...")
    } else if(!device || user.id !== device.owner) {
      throw new Error('Device not found...')
    } else {
      await devicePersistence.updateDevice({
        deviceId: device.id
      }, {
        active: false
      })
      return true
    }
  }
}
type Request = {
  uid: string
}
export default method