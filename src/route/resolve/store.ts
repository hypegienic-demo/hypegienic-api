import {PersistedUser, getUserEmployeeRole} from '../../persistence/user'
import {PersistedStore} from '../../persistence/store'
import {Utilities} from '../../app'

export const schema = `
  type Store {
    id: String!
    name: String!
    registrationNumber: String!
    address: String!
    balance: StoreBalance!
    transactions(
      before: String
      after: String
    ): [StoreTransaction!]!
    mobileNumber: String!
    email: String!
  }
  type StoreBalance {
    cash: Float!
    bank: Float!
    paymentGateway: Float!
  }
  type StoreTransaction {
    type: String!
    detail: String!
    time: String!
    amount: Float!
  }
`
const resolveStore = async(utilities:Utilities, user:PersistedUser, store:PersistedStore) => {
  const {blockPersistence, transactionPersistence} = utilities
  return {
    id: store.id,
    name: store.name,
    registrationNumber: store.registrationNumber,
    address: store.address,
    balance: () => {
      if(getUserEmployeeRole(user) !== 'admin') {
        throw new Error("User isn't authorized")
      }
      return {
        cash: () => {
          return blockPersistence.getCurrentAmount({
            type: 'store',
            balance: 'cash',
            store: store.id
          })
        },
        bank: () => {
          return blockPersistence.getCurrentAmount({
            type: 'store',
            balance: 'bank',
            store: store.id
          })
        },
        paymentGateway: () => {
          return blockPersistence.getCurrentAmount({
            type: 'store',
            balance: 'payment-gateway',
            store: store.id
          })
        }
      }
    },
    transactions: async(request:StoreTransactionRequest) => {
      if(getUserEmployeeRole(user) !== 'admin') {
        throw new Error("User isn't authorized")
      }
      const before = request.before
        ? new Date(Date.parse(request.before))
        : undefined
      const after = request.after
        ? new Date(Date.parse(request.after))
        : undefined
      const [payments, transactions] = await Promise.all([
        transactionPersistence.getPayments({
          storeId: store.id,
          before,
          after
        }),
        transactionPersistence.getTransactions({
          storeId: store.id,
          before,
          after
        })
      ])
      return [
        ...payments.flatMap(payment => {
          const invoiceId = `INV${[
            ...new Array(Math.max(5 - payment.invoiceId.toString().length, 0)).fill('0'),
            payment.invoiceId
          ].join('').slice(-5)}`
          return [
            {
              type: 'profit',
              detail: `${payment.payer} paid for ${invoiceId}`,
              time: payment.time,
              amount: payment.amount
            },
            ...payment.refundedOn? [{
              type: 'expense',
              detail: `Refunded to ${payment.payer} for ${invoiceId}`,
              time: payment.refundedOn,
              amount: payment.amount
            }]:[]
          ]
        }),
        ...transactions
          .filter(transaction => transaction.type !== 'transfer')
          .map(transaction => ({
            type: transaction.type === 'inflow'? 'profit':'expense',
            detail: transaction.remark !== ''
              ? transaction.remark
              : transaction.type === 'inflow'? 'Profit':'Expense',
            time: transaction.time,
            amount: transaction.amount
          }))
      ]
        .sort((transaction1, transaction2) =>
          transaction2.time.getTime() - transaction1.time.getTime()
        )
        .map(transaction => ({
          ...transaction,
          time: transaction.time.toISOString()
        }))
    },
    mobileNumber: store.mobileNumber,
    email: store.email
  }
}
type StoreTransactionRequest = {
  before?: string
  after?: string
}
export default resolveStore