import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import TransactionPersistence, {Transaction} from '../../src/persistence/transaction'

const transactions:Transaction[] = []
export default class MockTransactionPersistence extends TransactionPersistence {
  initializeData = async(session:Session) => {
    for(const transaction of transactions) {
      await session.run(
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
        `MERGE (e) -[:FOR]-> (t)`
      )
    }
  }
}