import * as fs from 'fs'

import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {Upload} from '../upload'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'addTransaction',
  request: [
    'transaction: String!',
    'amount: Float!',
    'remark: String!',
    'attachments: [Upload!]!',
    'from: AddTransactionTarget',
    'to: AddTransactionTarget',
    'time: String'
  ],
  response: 'Boolean',
  schema: `
    input AddTransactionTarget {
      storeId: String!
      balance: String!
    }
  `,
  resolver: async(utilities, request, argument) => {
    const {
      socket,
      authenticationStore,
      userPersistence,
      filePersistence,
      blockPersistence,
      storePersistence,
      transactionPersistence,
      spacesAPI
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
    if(!['inflow', 'outflow', 'transfer'].includes(request.transaction)) {
      throw new Error("Transaction isn't valid")
    }
    const [fromStore, toStore] = await Promise.all([
      request.from
        ? storePersistence.getStore({
            storeId: parseInt(request.from.storeId)
          })
        : undefined,
      request.to
        ? storePersistence.getStore({
            storeId: parseInt(request.to.storeId)
          })
        : undefined,
    ])
    if(
      (request.transaction === 'inflow' && !toStore) ||
      (request.transaction === 'outflow' && !fromStore) ||
      (request.transaction === 'transfer' && (!toStore || !fromStore))
    ) {
      throw new Error('Store not found')
    }
    if(
      (fromStore && !['cash', 'bank', 'payment-gateway'].includes(request.from?.balance?? '')) ||
      (toStore && !['cash', 'bank', 'payment-gateway'].includes(request.to?.balance?? ''))
    ) {
      throw new Error('Balance destination not valid')
    }
    if(
      request.transaction === 'transfer' &&
      fromStore?.id === toStore?.id &&
      request.from?.balance === request.to?.balance
    ) {
      throw new Error('Transfer source and destination cannnot be the same')
    }

    const attachments = await Promise.all(
      request.attachments.map(async(attachment) => {
        const buffer = await new Promise<Buffer>((resolve, reject) =>
          fs.readFile(attachment.path, (error, data) => {
            if (error) reject(error)
            else resolve(data)
          })
        )
        const file = await spacesAPI.uploadFile(attachment.originalFilename, buffer)
        return filePersistence.createFile({
          type: 'spaces',
          ...file
        })
      })
    )

    const time = request.time
      ? new Date(Date.parse(request.time))
      : new Date()
    const persistedTransaction = await transactionPersistence.createTransaction({
      type: request.transaction,
      amount: request.amount,
      remark: request.remark,
      attachments: attachments.map(attachment => attachment.id),
      requestor: user.id,
      time,
    })
    await blockPersistence.createBlock(
      persistedTransaction.type === 'inflow'
        ? {
            type: 'top-up',
            transaction: persistedTransaction.id,
            amount: persistedTransaction.amount,
            time,
            to: {
              type: 'store',
              balance: request.to?.balance?? 'cash',
              store: toStore?.id?? 0
            }
          }
        : persistedTransaction.type === 'outflow'
        ? {
            type: 'spent',
            transaction: persistedTransaction.id,
            amount: persistedTransaction.amount,
            time,
            from: {
              type: 'store',
              balance: request.from?.balance?? 'cash',
              store: fromStore?.id?? 0
            }
          }
        : {
            type: 'transfer',
            transaction: persistedTransaction.id,
            amount: persistedTransaction.amount,
            time,
            to: {
              type: 'store',
              balance: request.to?.balance?? 'cash',
              store: toStore?.id?? 0
            },
            from: {
              type: 'store',
              balance: request.from?.balance?? 'cash',
              store: fromStore?.id?? 0
            }
          }
    )
    socket.emit('block-added')
    return true
  }
}
type Request = {
  transaction: 'inflow' | 'outflow' | 'transfer'
  amount: number
  remark: string
  attachments: Upload[]
  from?: Target
  to?: Target
  time?: string
}
type Target = {
  storeId: string
  balance: 'cash' | 'bank' | 'payment-gateway'
}
export default method