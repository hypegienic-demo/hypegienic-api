import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import DevicePersistence, {Device} from '../../src/persistence/device'

const devices:Device[] = []
export default class MockDevicePersistence extends DevicePersistence {
  initializeData = async(session:Session) => {
    for(const device of devices) {
      await session.run(
        `CREATE (d:device {\n` +
        (Object.keys(device) as (keyof typeof device)[])
          .filter(key => !['owner'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(device[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `WITH d\n` +
        `MATCH (u:user)\n` +
        `WHERE ID(u) = ${device.owner}\n` +
        `CREATE (d) <-[:OWNED]- (u)\n` +
        `CREATE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(device) as (keyof typeof device)[])
          .filter(key => device[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(device[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (d)`
      )
    }
  }
}