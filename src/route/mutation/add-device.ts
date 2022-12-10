import {Method} from '..'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'addDevice',
  request: [
    'uid: String!',
    'token: String!'
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
    } else {
      if(device) {
        const newDevice = {
          owner: user.id !== device.owner
            ? user.id
            : undefined,
          token: device.token !== request.token
            ? request.token
            : undefined,
          active: !device.active? true:undefined
        }
        const updates = (Object.keys(newDevice) as (keyof typeof newDevice)[])
          .filter(key => newDevice[key] !== undefined)
        if(updates.length > 0) {
          await devicePersistence.updateDevice({
            deviceId: device.id
          }, updates.reduce((device, key) => ({
            ...device,
            [key]: newDevice[key]
          }), {}))
        }
      } else {
        await devicePersistence.createDevice({
          owner: user.id,
          uid: request.uid,
          token: request.token,
          active: true
        })
      }
      return true
    }
  }
}
type Request = {
  uid: string
  token: string
}
export default method