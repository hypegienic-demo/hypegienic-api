import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import ServicePersistence from '../../src/persistence/service'

type Service = {
  name: string
  description?: string
} & ({
  type: 'main'
  icon: string
  exclude: string[]
} | {
  type: 'additional'
}) & ({
  pricing: 'fixed'
  pricingAmount: number
} | {
  pricing: 'variable'
})
const services:Service[] = [{
  type: 'main',
  name: 'Clean',
  pricing: 'fixed',
  pricingAmount: 39,
  icon: 'clean-shoe',
  exclude: []
}, {
  type: 'main',
  name: 'Crisp',
  pricing: 'fixed',
  pricingAmount: 69,
  icon: 'spray-clean-shoe',
  exclude: []
}, {
  type: 'main',
  name: 'Sole protect',
  pricing: 'variable',
  icon: 'spray-clean-shoe',
  exclude: ['Sole protect']
}, {
  type: 'additional',
  name: 'Water repellent treatment',
  pricing: 'fixed',
  pricingAmount: 15
}, {
  type: 'additional',
  name: 'Disinfectant',
  pricing: 'fixed',
  pricingAmount: 15
}, {
  type: 'additional',
  name: 'Sole protect',
  pricing: 'variable'
}]
export default class MockServicePersistence extends ServicePersistence {
  initializeData = async(session:Session) => {
    const mapServicePoint = (service:Service) => service.type === 'main'? service.exclude.length:0
    for(const service of services.sort((service1, service2) =>
      mapServicePoint(service1) - mapServicePoint(service2)
    )) {
      await session.run(
        `CREATE (s:service {\n` +
        (Object.keys(service) as (keyof typeof service)[])
          .filter(key => !['exclude'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(service[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        (service.type === 'main' && service.exclude.length > 0
          ? `WITH s\n` +
            `MATCH (ex:service) WHERE s <> ex AND ex.name IN ${stringify(service.exclude)}\n` +
            `CREATE (s) -[:EXCLUDE]-> (ex)\n`
          : '') +
        `CREATE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(service) as (keyof typeof service)[])
          .filter(key => service[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(service[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (s)`
      )
    }
  }
}