import {Persistence, stringify, resolveObject} from './'

class TransactionPersistence extends Persistence {
  createTransaction = (transaction:Transaction):Promise<PersistedTransaction> => {
    return this.execute(
      `MERGE (t:transaction {\n` +
      (Object.keys(transaction) as (keyof typeof transaction)[])
        .filter(key => !['attachments'].includes(key))
        .map(key =>
          `  ${key}: ${stringify(transaction[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      (transaction.attachments.length > 0
        ? `WITH t\n` +
          `MATCH (f:file)\n` +
          `WHERE ID(f) IN ${stringify(transaction.attachments)}\n` +
          `MERGE (f) -[:ATTACHED_TO]-> (t)\n`
        : '') +
      `WITH t\n` +
      `MATCH (u:user) WHERE ID(u) = ${transaction.requestor}\n` +
      `MERGE (t) <-[:REQUESTED]- (u)\n` +
      `MERGE (e:event {\n` +
      `  type: "created",\n` +
      `  time: datetime(),\n` +
      (Object.keys(transaction) as (keyof typeof transaction)[])
        .filter(key => transaction[key] !== undefined)
        .map(key =>
          `  _${key}: ${stringify(transaction[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      `MERGE (e) -[:FOR]-> (t)\n` +
      `WITH t\n` +
      `OPTIONAL MATCH (t) <-[:ATTACHED_TO]- (f:file)\n` +
      `OPTIONAL MATCH (t) <-[:REQUESTED]- (requestor:user)\n` +
      `RETURN t, COLLECT(DISTINCT f) AS attachments, requestor`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }

  getTransactions = (where: {
    storeId?: number
    after?: Date
    before?: Date
  }):Promise<PersistedTransaction[]> => {
    let query:string = ''
    if(where.storeId !== undefined) query +=
      `WITH t\n` +
      `OPTIONAL MATCH (t) -[:RELATED_TO]-> (:block) --> (s:store)\n` +
      `WHERE ID(s) = ${stringify(where.storeId)}\n`
    if(where.before !== undefined) query +=
      `WITH t\n` +
      `WHERE t.time <= ${stringify(where.before)}\n`
    if(where.after !== undefined) query +=
      `WITH t\n` +
      `WHERE t.time >= ${stringify(where.after)}\n`

    return this.execute(
      `MATCH (t:transaction)\n` +
      query +
      `RETURN t`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }

  getPayments = (where: {
    storeId?: number
    after?: Date
    before?: Date
  }):Promise<(PersistedPayment & {
    payer: string
    invoiceId: number
    refundedOn?: Date
  })[]> => {
    let query:string = ''
    if(where.storeId !== undefined) query +=
      `WITH p\n` +
      `OPTIONAL MATCH (p) -[:PAID]-> (:request) -[:MADE_AT]-> (physical:store)\n` +
      `OPTIONAL MATCH (p) -[:PAID]-> (:request) -[:CONTAIN]-> (:order) -[:OPENED]-> (:lockerUnit) <-[:HOUSE]- (:locker) <-[:RESPONSIBLE]- (locker:store)\n` +
      `WHERE ID(physical) = ${stringify(where.storeId)} or ID(locker) = ${stringify(where.storeId)}\n`
    if(where.before !== undefined) query +=
      `WITH p\n` +
      `WHERE p.time <= ${stringify(where.before)}\n`
    if(where.after !== undefined) query +=
      `WITH p\n` +
      `WHERE p.time >= ${stringify(where.after)}\n`

    return this.execute(
      `MATCH (p:payment)\n` +
      query +
      `WITH p\n` +
      `OPTIONAL MATCH (p) -[:PAID]-> (r:request) <-[:ORDER]- (o:user)\n` +
      `OPTIONAL MATCH (p) -[:RELATED_TO]-> (b:block {type:'spent'})\n` +
      `RETURN p, o.displayName AS payer, r.invoiceId AS invoiceId, b.time as refundedOn`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }
}
export type Transaction = {
  type: 'inflow' | 'outflow' | 'transfer'
  amount: number
  remark: string
  attachments: number[]
  requestor: number
  time: Date
}
export type PersistedTransaction = Transaction & {
  id: number
}
export type Payment = {
  amount: number
  time: Date
} & (
  | {
      type: 'cash' | 'payment-gateway'
    }
  | {
      type: 'bank-transfer' | 'credit-debit-card' | 'cheque'
      reference: string
    }
)
export type PersistedPayment = Payment & {
  id: number
}
export default TransactionPersistence