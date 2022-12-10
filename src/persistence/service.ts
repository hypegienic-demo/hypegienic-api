import {Persistence, resolveObject} from './'

class ServicePersistence extends Persistence {
  getService = (where: {
    serviceId?: number
  }):Promise<PersistedService> => {
    let query:string = ''
    if(where.serviceId !== undefined) query += `WHERE ID(s) = ${where.serviceId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (s:service)\n` +
        query +
        `OPTIONAL MATCH (s) -[:EXCLUDE]-> (e:service)\n` +
        `RETURN s, COLLECT(e) AS exclude`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing service query parameter')
    }
  }
  getServices = ():Promise<PersistedService[]> => {
    return this.execute(
      `MATCH (s:service)\n` +
      `OPTIONAL MATCH (s) -[:EXCLUDE]-> (e:service)\n` +
      `RETURN s, COLLECT(e) AS exclude`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }
}
export type Service = {
  name: string
  description?: string
} & ({
  type: 'main'
  icon: string
  exclude: number[]
} | {
  type: 'additional'
}) & ({
  pricing: 'fixed'
  pricingAmount: number
} | {
  pricing: 'variable'
})
export type PersistedService = Service & {
  id: number
}
export default ServicePersistence