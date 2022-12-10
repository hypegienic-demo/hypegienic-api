import {Method} from '..'
import resolveStore from '../resolve/store'

const method:Method<Request, ReturnType<typeof resolveStore>[]> = {
  type: 'query',
  title: 'displayStores',
  request: [
    'storeId: String'
  ],
  response: '[Store!]',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      storePersistence
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    const stores = request.storeId
      ? [await storePersistence.getStore({
          storeId: parseInt(request.storeId)
        })]
      : await storePersistence.getStores()

    return stores.map(store =>
      resolveStore(utilities, user, store)
    )
  }
}
type Request = {
  storeId?: string
}
export default method