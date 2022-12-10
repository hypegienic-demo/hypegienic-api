import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import UserPersistence, {User, UserIdentity} from '../../src/persistence/user'

const identities:(Pick<UserIdentity, 'type'>)[] = [{
  type: 'employee'
}, {
  type: 'student'
}]
const users:User[] = [{
  firebaseId: 'chingyawhao',
  discordId: 'chingyawhao',
  displayName: 'Hao',
  mobileNumber: '+60129126858',
  email: 'chingyawhao14@gmail.com',
  address: '47, Jalan Budiman 3, Taman Mulia, 56000 Cheras, Kuala Lumpur.',
  identities: [{
    type: 'employee',
    role: 'admin'
  }]
}, {
  firebaseId: 'chingyawjin',
  displayName: 'Jin',
  mobileNumber: '+60124295578',
  email: 'chingyawjin@gmail.com',
  address: '47, Jalan Budiman 3, Taman Mulia, 56000 Cheras, Kuala Lumpur.',
  identities: []
}, {
  firebaseId: 'limsimyee',
  displayName: 'Sim',
  mobileNumber: '+601110762614',
  email: 'simyeelim@outlook.com',
  address: 'Covillea, 8, Jalan Jalil Perkasa 7, 57000 Bukit Jalil, Kuala Lumpur.',
  identities: [{
    type: 'student'
  }]
}]
export default class MockUserPersistence extends UserPersistence {
  initializeData = async(session:Session) => {
    for(const identity of identities) {
      await session.run(
        `CREATE (uid:userIdentity {\n` +
        (Object.keys(identity) as (keyof typeof identity)[]).map(key =>
          `  ${key}: ${stringify(identity[key])}`
        ).join(',\n') + '\n' +
        `})`
      )
    }
    for(const user of users) {
      await session.run(
        `CREATE (u:user {\n` +
        (Object.keys(user) as (keyof typeof user)[])
          .filter(key => !['identities'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(user[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        user.identities.map(identity =>
          `WITH u\n` +
          `MATCH (uid:userIdentity) WHERE uid.type = ${stringify(identity.type)}\n` +
          `CREATE (u) -[:IDENTIFIED_AS {\n` +
          (Object.keys(identity) as (keyof typeof identity)[])
            .filter(key => !['type'].includes(key))
            .map(key =>
              `  ${key}: ${stringify(identity[key])}`
            ).join(',\n') + '\n' +
          `}]-> (uid)\n`
        ).join('') +
        `CREATE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(user) as (keyof typeof user)[])
          .filter(key => user[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(user[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (u)`
      )
    }
  }
}