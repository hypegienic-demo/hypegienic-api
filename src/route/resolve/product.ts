import {PersistedUser} from '../../persistence/user'
import {PersistedProduct} from '../../persistence/product'
import {Utilities} from '../../app'

export const schema = `
  type Product {
    id: String!
    name: String!
    price: ProductPrice!
  }
  type ProductPrice {
    type: String!
    amount: Float
  }

  type ProductOrdered {
    id: String!
    name: String!
    quantity: Int!
    assignedPrice: Float!
  }
`
const resolveProduct = async(utilities:Utilities, user:PersistedUser, product:PersistedProduct) => {
  return {
    ...await resolveProductCommon(utilities, user, product),
    price: product.pricing === 'fixed'? {
      type: product.pricing,
      amount: product.pricingAmount
    }:{
      type: product.pricing
    },
  }
}
export const resolveProductOrdered = async(utilities:Utilities, user:PersistedUser,
  product: PersistedProduct & {quantity:number, price:number}
) => {
  return {
    ...await resolveProductCommon(utilities, user, product),
    quantity: product.quantity,
    assignedPrice: product.price
  }
}
const resolveProductCommon = async(utilities:Utilities, user:PersistedUser, product:PersistedProduct) => {
  return {
    id: product.id,
    name: product.name,
  }
}
export default resolveProduct