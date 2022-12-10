import {Persistence, stringify, resolveObject} from './'

class MailPersistence extends Persistence {
  createMail = (mail:Mail):Promise<PersistedMail> => {
    return this.execute(
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
      `MERGE (e) -[:FOR]-> (m)\n` +
      `WITH m, e.time AS time\n` +
      `OPTIONAL MATCH (from:user) -[:SENT]-> (m)\n` +
      `OPTIONAL MATCH (to:user) <-[:SENT]- (m)\n` +
      `OPTIONAL MATCH (m) -[:ATTACHED]-> (f:file)\n` +
      `RETURN m, time, from, to, COLLECT(f) AS attachments`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }
}
export type Mail = {
  from: number
  to: number
  subject: string
  text: string
  attachments: number[]
}
export type PersistedMail = Mail & {
  id: number
  time: Date
}
export default MailPersistence