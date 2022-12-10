import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import ProductPersistence, {Product} from '../../src/persistence/product'

const products:Product[] = [{
  name: 'Shoe Box',
  pricing: 'fixed',
  pricingAmount: 49
}, {
  name: 'Premium Shoe Box',
  pricing: 'fixed',
  pricingAmount: 59
}, {
  name: 'Custom-made Shoe Box',
  pricing: 'variable'
}]
export default class MockProductPersistence extends ProductPersistence {
  initializeData = async(session:Session) => {
    for(const product of products) {
      await session.run(
        `CREATE (p:product {\n` +
        (Object.keys(product) as (keyof typeof product)[]).map(key =>
          `  ${key}: ${stringify(product[key])}`
        ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(product) as (keyof typeof product)[])
          .filter(key => product[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(product[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        `CREATE (e) -[:FOR]-> (p)`
      )
    }
  }
}