import {Method} from '..'

const method:Method<Request, Response> = {
  type: 'mutation',
  title: 'requestTopUp',
  request: [
    'type: String!',
    'amount: Float!'
  ],
  response: 'TopUpResponse!',
  schema: `
    type TopUpResponse {
      billPlzId: String
      amount: Float!
      url: String!
    }
  `,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      walletPersistence,
      billPlzAPI
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    }
    if(request.type === 'billplz') {
      const pendingAttempts = await walletPersistence.getBillPlzAttempts({
        userId: user.id,
        paid: false,
        due: false
      })
      const similarAttempt = pendingAttempts.find(attempt =>
        attempt.amount === request.amount
      )
      if(similarAttempt) {
        console.log(similarAttempt)
        return similarAttempt
      } else {
        const response = await billPlzAPI.requestTopUp({
          name: user.displayName,
          email: user.email,
          description: `You requested to top up RM${request.amount} into Hypegienic`,
          amount: request.amount * 100
        })
        if(!response.id) {
          throw new Error(
            `BillPlz response not expected:\n` +
            JSON.stringify(response)
          )
        }
        const billPlzAttempt = await walletPersistence.createBillPlzAttempt({
          billPlzId: response.id,
          collectionId: response.collection_id,
          amount: response.amount / 100,
          paidAmount: 0,
          description: response.description,
          url: response.url,
          due: new Date(Date.parse(response.due_at) + 24 * 60 * 60 * 1000),
          requestor: user.id
        })
        console.log(billPlzAttempt)
        return billPlzAttempt
      }
    } else {
      throw new Error('Top up request type not supported')
    }
  }
}
interface Request {
  type: string
  amount: number
}
interface Response {
  url: string
}

export default method