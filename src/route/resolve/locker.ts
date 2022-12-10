import {PersistedUser} from '../../persistence/user'
import {PersistedLocker, PersistedLockerUnit} from '../../persistence/locker'
import {Utilities} from '../../app'

export const schema = `
  type Locker {
    id: String!
    name: String!
    latitude: Float!
    longitude: Float!
    online: Boolean!
    rows: Int!
    columns: Int!
    units: [LockerUnit!]!
  }
  type LockerUnit {
    id: String!
    number: Int!
    row: Int!
    column: Int!
    locker: Locker
  }
`
const resolveLocker = async(utilities:Utilities, user:PersistedUser, locker:PersistedLocker) => {
  const {lockerPersistence, physicalLockerStore} = utilities
  return locker
    ? {
        id: locker.id,
        name: locker.name,
        latitude: locker.latitude,
        longitude: locker.longitude,
        online: () => physicalLockerStore.getIsLockerOnline(locker.name),
        rows: async() => {
          const lockerUnits = await lockerPersistence.getLockerUnits({lockerId:locker.id})
          return Math.max(...lockerUnits.map(unit => unit.row))
        },
        columns: async() => {
          const lockerUnits = await lockerPersistence.getLockerUnits({lockerId:locker.id})
          return Math.max(...lockerUnits.map(unit => unit.column))
        },
        units: async() => {
          const lockerUnits = await lockerPersistence.getLockerUnits({lockerId:locker.id})
          return lockerUnits.map(lockerUnit =>
            resolveLockerUnit(utilities, user, lockerUnit)
          )
        }
      }
    : undefined
}
export default resolveLocker
export const resolveLockerUnit = async(utilities:Utilities, user:PersistedUser, lockerUnit:PersistedLockerUnit) => {
  const { lockerPersistence } = utilities
  return lockerUnit
    ? {
        id: lockerUnit.id,
        number: lockerUnit.number,
        row: lockerUnit.row,
        column: lockerUnit.column,
        locker: async() => {
          const locker = await lockerPersistence.getLocker({lockerId:lockerUnit.locker})
          return resolveLocker(utilities, user, locker)
        }
      }
    : undefined
}