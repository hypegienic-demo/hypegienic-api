import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import FilePersistence, {File} from '../../src/persistence/file'

const files:File[] = []
export default class MockFilePersistence extends FilePersistence {
  initializeData = async(session:Session) => {
    for(const file of files) {
      await session.run(
        `CREATE (f:file {\n` +
        (Object.keys(file) as (keyof typeof file)[]).map(key =>
          `  ${key}: ${stringify(file[key])}`
        ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(file) as (keyof typeof file)[])
          .filter(key => file[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(file[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (f)`
      )
    }
  }
}