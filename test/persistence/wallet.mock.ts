import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import WalletPersistence, {BillPlzAttempt} from '../../src/persistence/wallet'

const billPlzAttempts:BillPlzAttempt[] = []
export default class MockWalletPersistence extends WalletPersistence {
  initializeData = async(session:Session) => {
    for(const attempt of billPlzAttempts) {
      await session.run(
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
        `CREATE (e) -[:FOR]-> (b)`
      )
    }
  }
}