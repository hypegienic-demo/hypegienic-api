import neo4j, {Driver, Record as QueryRecord, QueryResult} from 'neo4j-driver'
import {isNode, isRelationship} from 'neo4j-driver-core/lib/graph-types'
import * as FirebaseAdmin from 'firebase-admin'

export class Persistence {
  private driver:Driver
  constructor(host:string, authorized:{user:string, password:string}) {
    this.driver = host && authorized
      ? neo4j.driver(host, neo4j.auth.basic(authorized.user, authorized.password))
      : undefined as any
  }

  private cache:Record<string, Promise<QueryResult>> = {}
  protected execute = (command:string) => {
    const execute = async() => {
      const session = this.driver.session()
      const response = await session.run(command)
      await session.close()
      return response
    }
    if(ENV === 'development') {
      return execute()
    }
    if(['CREATE', 'MERGE', 'SET'].some(keyword => command.includes(keyword))) {
      this.cache = {}
      return execute()
    } else if(command in this.cache) {
      return this.cache[command] as Promise<QueryResult>
    } else {
      this.cache[command] = execute()
      return this.cache[command] as Promise<QueryResult>
    }
  }
}

export const stringify = (value:any):string => {
  if(Array.isArray(value)) {
    return `[${value.map(value => {
      const stringified = stringify(value)
      return stringified.startsWith('[')
        ? `"${stringified.replace(/"/g, "'")}"`
        : stringified
    }).join(', ')}]`
  } else if(value instanceof Date) {
    return `datetime(${JSON.stringify(value)})`
  } else if(typeof value === 'object') {
    return `"{` +
      Object.keys(value)
        .map(key =>
          `${key}:${stringify(value[key])}`.replace(/"/g, "'")
        )
        .join(', ') +
      `}"`
  } else {
    return JSON.stringify(value)
  }
}
export const parse = (value:string):any => {
  return JSON.parse(
    value.replace(/'/g, '"').replace(/([A-Za-z]+):/g, '"$1":')
  )
}

export const resolveObject = (record:QueryRecord) => {
  const node = record?.get(0)
  const resolveNeo4j = (property:any):any =>
    Array.isArray(property)
    ? property.map(resolveNeo4j)
    : isNode(property)
    ? property.identity.toNumber()
    : isRelationship(property)
    ? Object.keys(property.properties)
        .reduce((object, key) => 
          ({...object, [key]:resolveNeo4j(property.properties[key])}), {}
        )
    : neo4j.isInt(property)
    ? property.toNumber()
    : neo4j.isDateTime(property)
    ? new Date(property.toString())
    : property && typeof property === 'object'
    ? Object.keys(property)
        .reduce((object, key) => 
          ({...object, [key]:resolveNeo4j(property[key])}), {}
        )
    : property?? undefined
  const object = isNode(node)
    ? Object.keys(node.properties)
        .reduce((object, key) => ({
          ...object,
          [key]: resolveNeo4j(node.properties[key])
        }), {
          id: node.identity.toNumber()
        } as any)
    : resolveNeo4j(node)
  return object && record.length > 1
    ? new Array(record.length - 1)
        .fill(undefined)
        .map((_, index) => index + 1)
        .reduce((object, index) => {
          const key = record.keys[index] as PropertyKey
          const node = record.get(index)
          return {
            ...object,
            [key]: resolveNeo4j(node)
          }
        }, object)
    : object  
}

export class FirebaseStore {
  static app:FirebaseAdmin.app.App
  protected app:FirebaseAdmin.app.App
  constructor() {
    this.app = FirebaseStore.app
  }

  static initializeFirebase = (firebaseCredentials:FirebaseAdmin.ServiceAccount) => {
    if(!FirebaseStore.app) {
      FirebaseStore.app = firebaseCredentials
        ? FirebaseAdmin.initializeApp({
            credential: FirebaseAdmin.credential.cert(firebaseCredentials),
            databaseURL: 'https://hypegienic.firebaseio.com'
          })
        : undefined as any
    }
  }
}