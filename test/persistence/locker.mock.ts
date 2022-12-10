import {Session} from 'neo4j-driver'

import Socket from '../../src/socket'
import {stringify} from '../../src/persistence'
import LockerPersistence, {PhysicalLockerStore, Locker, LockerUnit} from '../../src/persistence/locker'

const lockers:(Omit<Locker, 'store' | 'units'> & {
  store: string
  units: LockerUnit[]
})[] = [{
  name: 'Sunway',
  store: 'Hype Guardian Sdn Bhd',
  latitude: 3.0665402,
  longitude: 101.6002593,
  serialNumber: '00001',
  active: true,
  units: Array(3).fill(undefined).map((_, index) => ({
    number: index + 1,
    row: index % 5 + 1,
    column: Math.floor(index / 5) + 1
  }))
}, {
  name: 'Taylor',
  store: 'Hype Guardian Sdn Bhd',
  latitude: 3.0625881,
  longitude: 101.6168253,
  serialNumber: '00002',
  active: true,
  units: Array(3).fill(undefined).map((_, index) => ({
    number: index + 1,
    row: index % 5 + 1,
    column: Math.floor(index / 5) + 1
  }))
}]
export default class MockLockerPersistence extends LockerPersistence {
  initializeData = async(session:Session) => {
    for(const locker of lockers) {
      await session.run(
        `CREATE (l:locker {\n` +
        (Object.keys(locker) as (keyof typeof locker)[])
          .flatMap(key => key !== 'store' && key !== 'units'? [key]:[])
          .map(key =>
            `  ${key}: ${stringify(locker[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        locker.units.map(lockerUnit =>
          `CREATE (:lockerUnit {\n` +
          (Object.keys(lockerUnit) as (keyof typeof lockerUnit)[])
            .filter(key => !['column', 'row'].includes(key))
            .map(key =>
              `  ${key}: ${stringify(lockerUnit[key])}`
            ).join(',\n') + '\n' +
          `}) <-[:HOUSE {\n` +
          (Object.keys(lockerUnit) as (keyof typeof lockerUnit)[])
            .filter(key => ['column', 'row'].includes(key))
            .map(key =>
              `  ${key}: ${stringify(lockerUnit[key])}`
            ).join(',\n') + '\n' +
          `}]- (l)\n`
        ).join('') +
        `WITH l\n` +
        `MATCH (s:store) WHERE s.name = ${stringify(locker.store)}\n` +
        `CREATE (l) <-[:RESPONSIBLE]- (s)`
      )
    }
  }
}

export const physicalRecords = lockers
  .reduce<Record<string, ('unlocked' | 'locked')[]>>((physicalRecords, locker) => ({
    ...physicalRecords,
    [locker.name]: locker.units
      .map(_ => 'locked')
  }), {})
export class MockPhysicalLockerStore extends PhysicalLockerStore {
  constructor(utilities: {
    socket: Socket
    lockerPersistence: MockLockerPersistence
  }) {
    super(utilities)
  }

  getLockerUnits = async(name:string) => {
    return physicalRecords[name]?? []
  }
  setLockerUnit = async(name:string, index:number, status:'unlocked' | 'locked') => {
    const physicalLocker = physicalRecords[name]
    if(physicalLocker) physicalLocker[index] = status
    return physicalRecords[name]?? []
  }
}