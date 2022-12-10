import {Persistence, stringify, resolveObject} from './'

class UserPersistence extends Persistence {
  createUser = (user:User):Promise<PersistedUser> => {
    return this.execute(
      `CREATE (u:user {\n` +
      (Object.keys(user) as (keyof typeof user)[])
        .filter(key => !['identities'].includes(key))
        .map(key =>
          `  ${key}: ${stringify(user[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      `CREATE (e:event {\n` +
      `  type: "created",\n` +
      `  time: datetime(),\n` +
      (Object.keys(user) as (keyof typeof user)[])
        .filter(key => user[key] !== undefined)
        .map(key =>
          `  _${key}: ${stringify(user[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      `CREATE (e) -[:FOR]-> (u)\n` +
      `WITH u\n` +
      `OPTIONAL MATCH (u) -[id:IDENTIFIED_AS]-> (uid:userIdentity)\n` +
      `RETURN u, COLLECT(id {.*, type:uid.type}) AS identities`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }
  updateUser = (where: {
    userId?: number
    firebaseId?: string
    mobileNumber?: string
  }, user:Partial<User>):Promise<PersistedUser> => {
    let query:string = ''
    if(where.userId !== undefined) query += `WHERE ID(u) = ${where.userId}\n`
    if(where.firebaseId !== undefined) query += `WHERE u.firebaseId = ${stringify(where.firebaseId)}\n`
    if(where.mobileNumber !== undefined) query += `WHERE u.mobileNumber = ${stringify(where.mobileNumber)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (u:user)\n` +
        query +
        (Object.keys(user) as (keyof typeof user)[])
          .filter(key => !['identities'].includes(key))
          .map(key =>
            `SET u.${key} = ${stringify(user[key])}\n`
          ).join('') +
        `CREATE (e:event {\n` +
        `  type: "updated",\n` +
        `  time: datetime(),\n` +
        (Object.keys(user) as (keyof typeof user)[])
          .filter(key => user[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(user[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (u)\n` +
        `WITH u\n` +
        `OPTIONAL MATCH (u) -[id:IDENTIFIED_AS]-> (uid:userIdentity)\n` +
        `RETURN u, COLLECT(id {.*, type:uid.type}) AS identities`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing user query parameter')
    }
  }
  getUser = (where: {
    userId?: number
    firebaseId?: string
    discordId?: string
    mobileNumber?: string
    email?: string
  }):Promise<PersistedUser> => {
    let query:string = ''
    if(where.userId !== undefined) query += `WHERE ID(u) = ${where.userId}\n`
    if(where.firebaseId !== undefined) query += `WHERE u.firebaseId = ${stringify(where.firebaseId)}\n`
    if(where.discordId !== undefined) query += `WHERE u.discordId = ${stringify(where.discordId)}\n`
    if(where.mobileNumber !== undefined) query += `WHERE u.mobileNumber = ${stringify(where.mobileNumber)}\n`
    if(where.email !== undefined) query += `WHERE u.email = ${stringify(where.email)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (u:user)\n` +
        query +
        `OPTIONAL MATCH (u) -[id:IDENTIFIED_AS]-> (uid:userIdentity)\n` +
        `RETURN u, COLLECT(id {.*, type:uid.type}) AS identities`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing user query parameter')
    }
  }
  getUsers = ():Promise<PersistedUser[]> => {
    return this.execute(
      `MATCH (u:user)\n` +
      `OPTIONAL MATCH (u) -[id:IDENTIFIED_AS]-> (uid:userIdentity)\n` +
      `RETURN u, COLLECT(id {.*, type:uid.type}) AS identities`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }
}
export type User = {
  firebaseId?: string
  discordId?: string
  displayName: string
  mobileNumber: string
  email: string
  address?: string
  identities: UserIdentity[]
}
export type PersistedUser = User & {
  id: number
}
export type UserIdentity = (
  | {
      type: 'employee'
      role: 'admin' | 'staff'
    }
  | {
      type: 'student'
    }
)
export const getUserEmployeeRole = (user:PersistedUser) => {
  const employee = user.identities
    .flatMap(identity => identity.type === 'employee'? [identity]:[])[0]
  return employee?.role
}
export default UserPersistence