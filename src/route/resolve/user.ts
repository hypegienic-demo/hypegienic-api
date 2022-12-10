import {PersistedUser, getUserEmployeeRole} from '../../persistence/user'
import {Utilities} from '../../app'

export const schema = `
  type User {
    id: String!
    firebaseId: String
    displayName: String!
    walletBalance: Float!
    mobileNumber: String!
    email: String
    address: String
    employee: String
  }
`
export default async(utilities:Utilities, user:PersistedUser) => {
  const {blockPersistence} = utilities
  return {
    id: user.id,
    firebaseId: user.firebaseId,
    displayName: user.displayName,
    walletBalance: () => 
      blockPersistence.getCurrentAmount({
        type: 'user',
        balance: 'payment-gateway',
        user: user.id
      })?? 0,
    mobileNumber: user.mobileNumber,
    email: user.email,
    address: user.address,
    employee: () => getUserEmployeeRole(user)
  }
}