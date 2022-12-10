import {Persistence, stringify, resolveObject} from './'

class DevicePersistence extends Persistence {
  createDevice = (device:Device):Promise<PersistedDevice> => {
    return this.execute(
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
      `CREATE (e) -[:FOR]-> (d)\n` +
      `RETURN d, u AS owner`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }
  updateDevice = (where: {
    deviceId?: number
    uid?: string
  }, device:Partial<Device>):Promise<PersistedDevice> => {
    let query:string = ''
    if(where.deviceId !== undefined) query += `WHERE ID(d) = ${where.deviceId}\n`
    if(where.uid !== undefined) query += `WHERE d.uid = ${stringify(where.uid)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (d:device)\n` +
        query +
        (Object.keys(device) as (keyof typeof device)[])
          .filter(key => !['owner'].includes(key))
          .map(key =>
            `SET d.${key} = ${stringify(device[key])}\n`
          ).join('') +
        (device.owner !== undefined
          ? `WITH d\n` +
            `MATCH (d) <-[o:OWNED]- (:user)\n` +
            `DELETE o\n` +
            `WITH d\n` +
            `MATCH (u:user)\n` +
            `WHERE ID(u) = ${device.owner}\n` +
            `CREATE (d) <-[:OWNED]- (u)\n`
          : '') +
        `CREATE (e:event {\n` +
        `  type: "updated",\n` +
        `  time: datetime(),\n` +
        (Object.keys(device) as (keyof typeof device)[])
          .filter(key => device[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(device[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (d)\n` +
        `WITH d\n` +
        `MATCH (d) <-[:OWNED]- (owner:user)\n` +
        `RETURN d, owner`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing user query parameter')
    }
  }
  getDevice = (where: {
    deviceId?: number
    uid?: string
  }):Promise<PersistedDevice> => {
    let query:string = ''
    if(where.deviceId !== undefined) query += `WHERE ID(d) = ${where.deviceId}\n`
    if(where.uid !== undefined) query += `WHERE d.uid = ${stringify(where.uid)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (d:device)\n` +
        query +
        `WITH d\n` +
        `MATCH (d) <-[:OWNED]- (owner:user)\n` +
        `RETURN d, owner`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing device query parameter')
    }
  }
  getDevices = (where: {
    ownerId?: number
  }):Promise<PersistedDevice[]> => {
    let query:string = ''
    if(where.ownerId !== undefined) query +=
      `MATCH (u:user)\n` +
      `WHERE ID(u) = ${where.ownerId}\n` +
      `WITH d, u\n` +
      `WHERE (d) <-[:OWNED]- (u)\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (d:device)\n` +
        query +
        `WITH d\n` +
        `MATCH (d) <-[:OWNED]- (owner:user)\n` +
        `RETURN d, owner`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing device query parameter')
    }
  }
}
export type Device = {
  owner: number
  uid: string
  token: string
  active: boolean
}
export type PersistedDevice = Device & {
  id: number
}
export default DevicePersistence