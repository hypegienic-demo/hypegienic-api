import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import MailPersistence, {Mail} from '../../src/persistence/mail'

const mails:Mail[] = []
export default class MockMailPersistence extends MailPersistence {
  initializeData = async(session:Session) => {
    for(const mail of mails) {
      await session.run(
        `MERGE (m:mail {\n` +
        (Object.keys(mail) as (keyof typeof mail)[])
          .filter(key => !['from', 'to', 'attachments'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(mail[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `WITH m\n` +
        `MATCH (from:user) WHERE ID(from) = ${mail.from}\n` +
        `MERGE (from) -[:SENT]-> (m)\n` +
        `WITH m\n` +
        `MATCH (to:user) WHERE ID(to) = ${mail.to}\n` +
        `MERGE (to) <-[:SENT]- (m)\n` +
        `WITH m\n` +
        `MATCH (f:file) WHERE ID(f) IN [${mail.attachments.join(', ')}]\n` +
        `MERGE (m) -[:ATTACHED]-> (f)\n` +
        `WITH m\n` +
        `MERGE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(mail) as (keyof typeof mail)[])
          .filter(key => mail[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(mail[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `MERGE (e) -[:FOR]-> (m)`
      )
    }
  }
}
