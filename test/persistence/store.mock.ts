import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import StorePersistence, {Store} from '../../src/persistence/store'

const stores:Store[] = [{
  name: 'Hype Guardian Sdn Bhd',
  registrationNumber: '202001007902(1364222-H)',
  address: '37-1, Jalan PJS11/7, Bandar Sunway, 46150 Petaling Jaya, Selangor.',
  mobileNumber: '+60177866887',
  email: 'hypeguardianmy@gmail.com'
}]
export default class MockStorePersistence extends StorePersistence {
  initializeData = async(session:Session) => {
    for(const store of stores) {
      await session.run(
        `CREATE (s:store {\n` +
        (Object.keys(store) as (keyof typeof store)[]).map(key =>
          `  ${key}: ${stringify(store[key])}`
        ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(store) as (keyof typeof store)[])
          .filter(key => store[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(store[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (s)`
      )
    }
  }
}