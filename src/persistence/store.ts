import {Persistence, resolveObject} from './'

class StorePersistence extends Persistence {
  getStore = (where: {
    storeId?: number
  }):Promise<PersistedStore> => {
    let query:string = ''
    if(where.storeId !== undefined) query += `WHERE ID(s) = ${where.storeId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (s:store)\n` +
        query +
        `RETURN s`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing store query parameter')
    }
  }
  getStores = ():Promise<PersistedStore[]> => {
    return this.execute(
      `MATCH (s:store)\n` +
      `RETURN s`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }
}
export type Store = {
  name: string
  registrationNumber: string
  address: string
  mobileNumber: string
  email: string
}
export type PersistedStore = Store & {
  id: number
}
export default StorePersistence