import {Persistence, resolveObject} from './'

class ProductPersistence extends Persistence {
  getProduct = (where: {
    productId?: number
  }):Promise<PersistedProduct> => {
    let query:string = ''
    if(where.productId !== undefined) query += `WHERE ID(p) = ${where.productId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (p:product)\n` +
        query +
        `RETURN p`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing product query parameter')
    }
  }
  getProducts = ():Promise<PersistedProduct[]> => {
    return this.execute(
      `MATCH (p:product)\n` +
      `RETURN p`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }
}
export type Product = {
  name: string
} & (
  | {
      pricing: 'fixed'
      pricingAmount: number
    }
  | {
      pricing: 'variable'
    }
)
export type PersistedProduct = Product & {
  id: number
}
export default ProductPersistence