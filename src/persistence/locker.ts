import * as FirebaseAdmin from 'firebase-admin'

import Socket, {SocketConnection} from '../socket'
import {Persistence, FirebaseStore, stringify, resolveObject} from './'

class LockerPersistence extends Persistence {
  protected queue:Record<string, {
    promise: Promise<() => void>
    resolve: () => void
  }[]>
  constructor(host:string, authorized:{user:string, password:string}) {
    super(host, authorized)
    this.queue = {}
  }

  queueLocker = async(lockerId:number):Promise<() => void> => {
    let resolve:() => void = () => {}
    if(!this.queue[lockerId]) this.queue[lockerId] = []
    const promise = new Promise<() => void>(done => {
      resolve = () => done(() => {
        this.queue[lockerId] = this.queue[lockerId]?.slice(1)?? []
        this.queue[lockerId]?.[0]?.resolve()
      })
    })
    if(this.queue[lockerId]?.length === 0) resolve()
    this.queue[lockerId]?.push({
      promise,
      resolve
    })
    return promise
  }
  getLockers = ():Promise<PersistedLocker[]> => {
    return this.execute(
      `MATCH (l:locker) -[h:HOUSE]-> (lu:lockerUnit)\n` +
      `OPTIONAL MATCH (l) <-[:RESPONSIBLE]- (store:store)\n` +
      `RETURN l, store, COLLECT(lu) AS units`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }
  getLocker = (where: {
    lockerId?: number
    lockerUnitId?: number
    lockerName?: string
  }):Promise<PersistedLocker> => {
    let query:string = ''
    if(where.lockerId !== undefined) query += `WHERE ID(l) = ${where.lockerId}\n`
    if(where.lockerUnitId !== undefined) query +=
      `WITH l\n` +
      `MATCH (l:locker) -[h:HOUSE]-> (lu:lockerUnit)\n` +
      `WHERE ID(lu) = ${where.lockerUnitId}\n`
    if(where.lockerName !== undefined) query += `WHERE l.name = ${stringify(where.lockerName)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (l:locker)\n` +
        query +
        `WITH l\n` +
        `OPTIONAL MATCH (l) <-[:RESPONSIBLE]- (store:store)\n` +
        `OPTIONAL MATCH (l) -[h:HOUSE]-> (lu:lockerUnit)\n` +
        `RETURN l, store, COLLECT(lu) AS units`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing locker query parameter')
    }
  }
  getLockerUnit = (where: {
    lockerUnitId?: number
  }):Promise<PersistedLockerUnit> => {
    let query:string = ''
    if(where.lockerUnitId !== undefined) query += `WHERE ID(lu) = ${where.lockerUnitId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (lu:lockerUnit)\n` +
        query +
        `WITH lu\n` +
        `OPTIONAL MATCH (lu) <-[h:HOUSE]- (locker:locker)\n` +
        `RETURN lu, locker, h.column AS column, h.row AS row`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing locker query parameter')
    }
  }
  getLockerUnits = (where: {
    lockerId?: number
  }):Promise<PersistedLockerUnit[]> => {
    let query:string = ''
    if(where.lockerId !== undefined) query +=
      `MATCH (l:locker)\n` +
      `WHERE ID(l) = ${where.lockerId}\n` +
      `WITH lu, l\n` +
      `WHERE (lu) <-[:HOUSE]- (l)\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (lu:lockerUnit)\n` +
        query +
        `WITH lu\n` +
        `OPTIONAL MATCH (lu) <-[h:HOUSE]- (locker:locker)\n` +
        `RETURN lu, locker, h.column AS column, h.row AS row`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing locker unit query parameter')
    }
  }
}
export type Locker = {
  name: string
  serialNumber?: string
  store: number
  latitude: number
  longitude: number
  units: number[]
  active: boolean
}
export type PersistedLocker = Locker & {
  id: number
}
export type LockerUnit = {
  number: number
  row: number
  column: number
}
export type PersistedLockerUnit = LockerUnit & {
  id: number
  locker: number
}
export default LockerPersistence

export class PhysicalLockerStore extends FirebaseStore {
  socket: Socket
  lockerPersistence: LockerPersistence
  lockerSockets:Record<string, SocketConnection>
  lockerUnits:Record<string, ('unlocked' | 'locked')[]>
  getStore:Promise<FirebaseAdmin.database.Reference>
  constructor(utilities: {
    socket: Socket
    lockerPersistence: LockerPersistence
  }) {
    super()
    this.socket = utilities.socket
    this.lockerPersistence = utilities.lockerPersistence
    this.lockerSockets = {}
    this.lockerUnits = {}
    this.getStore = this.app
      ? new Promise((resolve, reject) => {
          const lockerStore = this.app.database().ref(`${ENV}/locker`)
          lockerStore.on('value', state => {
            this.lockerUnits = state.val() ?? {}
            resolve(lockerStore)
          }, reject)
        })
      : undefined as any
    this.socket.on('connection', socket => {
      socket.on('locker-online', async(data) => {
        if(data.lockerName) {
          const locker = await this.lockerPersistence.getLocker({
            lockerName: data.lockerName
          })
          if(locker.serialNumber === data.serialNumber) {
            this.lockerSockets = {
              ...this.lockerSockets,
              [data.lockerName]: socket
            }
          }
          this.socket.emit('locker-online', {
            lockerId: locker.id.toString()
          })
        }
      })
      socket.on('locker-unit-close', async(data) => {
        const lockerName = Object.keys(this.lockerSockets)
          .find(lockerName => this.lockerSockets[lockerName]?.id === socket.id)
        if(lockerName && typeof data.unitId === 'number') {
          this.setLockerUnit(lockerName, data.unitId - 1, 'locked')
        }
      })
      socket.on('disconnect', async() => {
        const lockerName = Object.keys(this.lockerSockets)
          .find(lockerName => this.lockerSockets[lockerName]?.id === socket.id)
        if(lockerName) {
          delete this.lockerSockets[lockerName]
          const locker = await this.lockerPersistence.getLocker({
            lockerName
          })
          this.socket.emit('locker-offline', {
            lockerId: locker.id.toString()
          })
        }
      })
    })
  }
 
  getIsLockerOnline = (name:string) => {
    return Object.keys(this.lockerSockets).includes(name)
  }
  getLockerUnits = async(name:string) => {
    await this.getStore
    const locker = this.lockerUnits[name]
    if(!locker) {
      throw new Error('Physical locker not found')
    }
    return locker
  }
  setLockerUnit = async(name:string, index:number, status:'unlocked' | 'locked') => {
    const store = await this.getStore
    await store.child(name).update({
      [index]: status
    })
    const locker = this.lockerUnits[name]
    if(!locker) {
      throw new Error('Physical locker not found')
    }
    if(status === 'unlocked') {
      this.lockerSockets[name]?.emit('locker-unit-open', {unitId:index + 1})
    }
    locker[index] = status
    return locker
  }
}