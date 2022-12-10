import {PersistedUser} from './user'
import {ServiceOrder, ProductOrder} from './request'
import {Persistence, stringify, resolveObject} from './'

class CouponPersistence extends Persistence {
  getCoupon = async(where: {
    code?: string
  }):Promise<PersistedCoupon> => {
    let query = ''
    if(where.code !== undefined) query += `WHERE ${stringify(where.code)} IN c.codes\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (c:coupon)\n` +
        query +
        `WITH c\n` +
        `OPTIONAL MATCH (c) <-[u:USED]- (:request)\n` +
        `WITH c, COLLECT(DISTINCT u.code) AS usedCodes\n` +
        `OPTIONAL MATCH (c) <-[:APPLICABLE]- (discount:discount)\n` +
        `OPTIONAL MATCH (c) <-[:APPLICABLE]- (application:discountApplication)\n` +
        `WITH c, usedCodes, application,\n` +
        `COLLECT(discount {\n` +
        `  .*,\n` +
        `  id: ID(discount)\n` +
        `}) AS discounts\n` +
        `OPTIONAL MATCH (application) <-[:APPLICABLE]- (discount:discount)\n` +
        `WITH c, discounts, usedCodes, application,\n` +
        `COLLECT(discount {\n` +
        `  .*,\n` +
        `  id: ID(discount)\n` +
        `}) AS applicationDiscounts\n` +
        `OPTIONAL MATCH (application) -[:APPLICABLE_TO]-> (s:service)\n` +
        `OPTIONAL MATCH (application) -[:APPLICABLE_TO]-> (p:product)\n` +
        `WITH c, discounts, usedCodes,\n` +
        `application {\n` +
        `  .*,\n` +
        `  id: ID(application),\n` +
        `  servicesOrProducts: COLLECT(DISTINCT s) + COLLECT(DISTINCT p),\n` +
        `  discounts: applicationDiscounts\n` +
        `} AS a\n` +
        `RETURN c, discounts, usedCodes, COLLECT(a) AS applications`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing coupon query parameter')
    }
  }
  getCoupons = async(where: {
    effective?: boolean
  }):Promise<PersistedCoupon[]> => {
    let query:string = ''
    if(where.effective) query +=
      `WITH c\n` +
      `CALL {\n` +
      `  WHERE c.effectiveFor = 'always' OR c.effectiveFor = 'limited-per-user'\n` +
      `  RETURN c\n` +
      `  UNION\n` +
      `  WHERE c.effectiveFor = 'single-use' AND ANY(code IN c.codes WHERE NOT code IN c.singleUsedCodes)\n` +
      `  RETURN c\n` +
      `  UNION\n` +
      `  WHERE c.effectiveFor = 'expiry' AND MIN(c.effectiveBetween) < datetime() AND MAX(c.effectiveBetween) > datetime()\n` +
      `  RETURN c\n` +
      `}\n`

    return this.execute(
      `MATCH (c:coupon)\n` +
      query +
      `WITH c\n` +
      `OPTIONAL MATCH (c) <-[u:USED]- (:request)\n` +
      `WITH c, COLLECT(DISTINCT u.code) AS usedCodes\n` +
      `OPTIONAL MATCH (c) <-[:APPLICABLE]- (discount:discount)\n` +
      `OPTIONAL MATCH (c) <-[:APPLICABLE]- (application:discountApplication)\n` +
      `WITH c, usedCodes, application,\n` +
      `COLLECT(discount {\n` +
      `  .*,\n` +
      `  id: ID(discount)\n` +
      `}) AS discounts\n` +
      `OPTIONAL MATCH (application) <-[:APPLICABLE]- (discount:discount)\n` +
      `WITH c, discounts, usedCodes, application,\n` +
      `COLLECT(discount {\n` +
      `  .*,\n` +
      `  id: ID(discount)\n` +
      `}) AS applicationDiscounts\n` +
      `OPTIONAL MATCH (application) -[:APPLICABLE_TO]-> (s:service)\n` +
      `OPTIONAL MATCH (application) -[:APPLICABLE_TO]-> (p:product)\n` +
      `WITH c, discounts, usedCodes,\n` +
      `application {\n` +
      `  .*,\n` +
      `  id: ID(application),\n` +
      `  servicesOrProducts: COLLECT(DISTINCT s) + COLLECT(DISTINCT p),\n` +
      `  discounts: applicationDiscounts\n` +
      `} AS a\n` +
      `RETURN c, discounts, usedCodes, COLLECT(a) AS applications`
    ).then(result =>
      result.records.map(resolveObject) as PersistedCoupon[]
    )
  }
  getCouponCodes = async(where: {
    usedByUserId?: number
  }):Promise<string[]> => {
    let query:string = ''
    if(where.usedByUserId) query +=
      `WITH c, u, r\n` +
      `MATCH (user:user) WHERE ID(user) = ${where.usedByUserId} ` +
      `AND (r) <-[:ORDER]- (user:user)\n`

    return this.execute(
      `MATCH (c:coupon) <-[u:USED]- (r:request)\n` +
      query +
      `WITH u\n` +
      `RETURN u.code`
    ).then(result =>
      result.records.map(resolveObject) as string[]
    )
  }
}
export const calculateServiceProductPrice = (
  serviceOrProduct: ServiceOrder | ProductOrder,
  coupon: PersistedCoupon
) => {
  const originalPrice = serviceOrProduct.price
  const applicableDiscounts = coupon.appliesTo === 'all'
    ? coupon.discounts
    : coupon.applications.find(application =>
        application.servicesOrProducts.includes(serviceOrProduct.id)
      )?.discounts?? []
  return applicableDiscounts
    .sort((discountA, discountB) => discountA.id - discountB.id)
    .reduce(
      (price, discount) =>
        discount.type === 'fix'
          ? price - discount.amount
          : price * (1 - discount.amount / 100),
      originalPrice
    )
}
export const checkIfCouponCodeUsable = async(
  utilities: {
    couponPersistence: CouponPersistence
  },
  code: string,
  user: PersistedUser
) => {
  const {couponPersistence} = utilities
  const coupon = await couponPersistence.getCoupon({
    code
  })
  const now = Date.now()
  if(!coupon) {
    return false
  }
  if(coupon.eligibleFor === 'identity') {
    if(!user.identities.some(identity =>
      coupon.eligibleIdentities.includes(identity.type)
    )) {
      return false
    }
  }
  if(coupon.effectiveFor === 'single-use') {
    if(coupon.usedCodes.includes(code)) {
      return false
    }
  } else if(coupon.effectiveFor === 'limited-per-user') {
    const usedCoupons = await couponPersistence.getCouponCodes({
      usedByUserId: user.id
    })
    const usedSameCoupon = usedCoupons.filter(usedCoupon =>
      coupon.codes.includes(usedCoupon)
    )
    if(usedSameCoupon.length >= coupon.effectiveLimitedTo) {
      return false
    }
  } else if(coupon.effectiveFor === 'expiry') {
    if(
      now < coupon.effectiveBetween[0].getTime() ||
      now > coupon.effectiveBetween[1].getTime()
    ) {
      return false
    }
  }
  return true
}

export type Coupon = {
  purpose: string
  codes: string[]
} & (
  | {
      eligibleFor: 'all'
    }
  | {
      eligibleFor: 'identity'
      eligibleIdentities: string[]
    }
) & (
  | {
      effectiveFor: 'always'
    }
  | {
      effectiveFor: 'single-use'
      usedCodes: string[]
    }
  | {
      effectiveFor: 'limited-per-user'
      effectiveLimitedTo: number
    }
  | {
      effectiveFor: 'expiry'
      effectiveBetween: [Date, Date]
    }
) & (
  | {
      appliesTo: 'all'
      /**
       * Need to have an 'all' type to allow a discount to apply even to newly added service or product
       */
      discounts: CouponDiscount[]
    }
  | {
      appliesTo: 'limited'
      /**
       * If a service or product is found in multiple limitedTo,
       * only the first find should be applied
       */
      applications: {
        servicesOrProducts: number[]
        discounts: CouponDiscount[]
      }[]
    }
)
export type CouponDiscount = {
  id: number
} & (
  | {
      type: 'fix'
      amount: number
    }
  | {
      type: 'percent'
      amount: number
    }
)
export type PersistedCoupon = Coupon & {
  id: number
}

export default CouponPersistence