import {Persistence, stringify, resolveObject} from './'

class WalletPersistence extends Persistence {
  createBillPlzAttempt = (attempt:BillPlzAttempt):Promise<PersistedBillPlzAttempt> => {
    return this.execute(
      `CREATE (b:billPlzAttempt {\n` +
      (Object.keys(attempt) as (keyof typeof attempt)[])
        .filter(key => !['requestor'].includes(key))
        .map(key =>
          `  ${key}: ${stringify(attempt[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      `WITH b\n` +
      `MATCH (u:user)\n` +
      `WHERE ID(u) = ${attempt.requestor}\n` +
      `CREATE (b) <-[:REQUESTED]- (u)\n` +
      `CREATE (e:event {\n` +
      `  type: "created",\n` +
      `  time: datetime(),\n` +
      (Object.keys(attempt) as (keyof typeof attempt)[])
        .filter(key => attempt[key] !== undefined)
        .map(key =>
          `  _${key}: ${stringify(attempt[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      `CREATE (e) -[:FOR]-> (b)\n` +
      `WITH b\n` +
      `OPTIONAL MATCH (b) <-[:REQUESTED]- (requestor:user)\n` +
      `RETURN b, requestor`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }
  updateBillPlzAttempt = (
    where: {
      attemptId?: number
    },
    attempt: Partial<BillPlzAttempt>
  ):Promise<PersistedBillPlzAttempt> => {
    let query:string = ''
    if(where.attemptId !== undefined) query += `WHERE ID(b) = ${where.attemptId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (b:billPlzAttempt) <-[req:REQUESTED]- (u:user)\n` +
        query +
        (Object.keys(attempt) as (keyof typeof attempt)[])
          .filter(key => !['requestor'].includes(key))
          .map(key =>
            `SET b.${key} = ${stringify(attempt[key])}\n`
          ).join('') +
        (attempt.requestor
          ? `DELETE req\n` +
            `WITH b\n` +
            `MATCH (u:user)\n` +
            `WHERE ID(u) = ${attempt.requestor}\n` +
            `CREATE (b) <-[:REQUESTED]- (u)\n`
          : ''
        ) +
        `CREATE (e:event {\n` +
        `  type: "updated",\n` +
        `  time: datetime(),\n` +
        (Object.keys(attempt) as (keyof typeof attempt)[])
          .filter(key => attempt[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(attempt[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (b)\n` +
        `WITH b\n` +
        `OPTIONAL MATCH (b) <-[:REQUESTED]- (requestor:user)\n` +
        `RETURN b, requestor`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing billPlzAttempt query parameter')
    }
  }
  getBillPlzAttempt = (where: {
    attemptId?: number
    billPlzId?: string
  }):Promise<PersistedBillPlzAttempt> => {
    let query:string = ''
    if(where.attemptId !== undefined) query += `WHERE ID(b) = ${where.attemptId}\n`
    if(where.billPlzId !== undefined) query += 
      `WITH b\n` +
      `WHERE b.billPlzId = ${stringify(where.billPlzId)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (b:billPlzAttempt)\n` +
        query +
        `WITH b\n` +
        `OPTIONAL MATCH (b) <-[:REQUESTED]- (requestor:user)\n` +
        `RETURN b, requestor`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing billPlzAttempt query parameter')
    }
  }
  getBillPlzAttempts = (where: {
    userId?: number
    paid?: boolean
    due?: boolean
  }):Promise<PersistedBillPlzAttempt[]> => {
    let query:string = ''
    if(where.userId !== undefined) query +=
      `MATCH (u:user)\n` +
      `WHERE ID(u) = ${where.userId}\n` +
      `WITH b, u\n` +
      `WHERE (b) <-[:REQUESTED]- (u)\n`
    if(where.paid !== undefined) query += where.paid
      ? `WITH b\n` +
        `WHERE b.paidAmount >= b.amount\n`
      : `WITH b\n` +
        `WHERE b.paidAmount < b.amount\n`
    if(where.due !== undefined) query += where.due
      ? `WITH b\n` +
        `WHERE b.due <= datetime()\n`
      : `WITH b\n` +
        `WHERE b.due > datetime()\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (b:billPlzAttempt)\n` +
        query +
        `WITH b\n` +
        `OPTIONAL MATCH (b) <-[:REQUESTED]- (requestor:user)\n` +
        `RETURN b, requestor`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing billPlzAttempt query parameter')
    }
  }
}
export type BillPlzAttempt = {
  billPlzId: string
  collectionId: string
  amount: number
  paidAmount: number
  description: string
  url: string
  due: Date
  requestor: number
}
export type PersistedBillPlzAttempt = BillPlzAttempt & {
  id: number
}
export default WalletPersistence