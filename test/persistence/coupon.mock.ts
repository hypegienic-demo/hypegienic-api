import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import CouponPersistence, {CouponDiscount} from '../../src/persistence/coupon'

type Coupon = {
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
      discounts: Omit<CouponDiscount, 'id'>[]
    }
  | {
      appliesTo: 'limited'
      applications: {
        servicesOrProducts: string[]
        discounts: Omit<CouponDiscount, 'id'>[]
      }[]
    }
)
const coupons:Coupon[] = [{
  purpose: 'First time app user',
  codes: ['hypegienic-is-cool'],
  eligibleFor: 'all',
  effectiveFor: 'limited-per-user',
  effectiveLimitedTo: 2,
  appliesTo: 'all',
  discounts: [{
    type: 'percent',
    amount: 50
  }]
}, {
  purpose: 'Student user',
  codes: ['i-study-no-money'],
  eligibleFor: 'identity',
  eligibleIdentities: ['student'],
  effectiveFor: 'always',
  appliesTo: 'limited',
  applications: [{
    servicesOrProducts: ['Clean', 'Crisp'],
    discounts: [{
      type: 'fix',
      amount: 10
    }]
  }]
}]
export default class MockCouponPersistence extends CouponPersistence {
  initializeData = async(session:Session) => {
    for(const coupon of coupons) {
      await session.run(
        `MERGE (c:coupon {\n` +
        (Object.keys(coupon) as (keyof typeof coupon)[])
          .filter(key => !['discounts', 'applications'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(coupon[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        (coupon.appliesTo === 'all'
          ? `WITH c\n` +
            coupon.discounts.map(discount =>
              `MERGE (:discount {\n` +
              (Object.keys(discount) as (keyof typeof discount)[]).map(key =>
                `  ${key}: ${stringify(discount[key])}`
              ).join(',\n') + '\n' +
              `}) -[:APPLICABLE]-> (c)\n`
            ).join('')
          : coupon.applications.map(application =>
              `WITH c\n` +
              `MERGE (da:discountApplication) -[:APPLICABLE]-> (c)\n` +
              application.discounts.map(discount =>
                `MERGE (:discount {\n` +
                (Object.keys(discount) as (keyof typeof discount)[]).map(key =>
                  `  ${key}: ${stringify(discount[key])}`
                ).join(',\n') + '\n' +
                `}) -[:APPLICABLE]-> (da)\n`
              ).join('') +
              application.servicesOrProducts.map(serviceOrProduct =>
                `WITH c, da\n` +
                `OPTIONAL MATCH (s:service) WHERE s.name = ${stringify(serviceOrProduct)}\n` +
                `FOREACH (i IN CASE WHEN NOT s IS NULL THEN [1] ELSE [] END |\n` +
                `  MERGE (da) -[:APPLICABLE_TO]-> (s)\n` +
                `)\n` +
                `WITH c, da\n` +
                `OPTIONAL MATCH (p:product) WHERE p.name = ${stringify(serviceOrProduct)}\n` +
                `FOREACH (i IN CASE WHEN NOT p IS NULL THEN [1] ELSE [] END |\n` +
                `  MERGE (da) -[:APPLICABLE_TO]-> (p)\n` +
                `)\n`
              ).join('')
            ).join('')
        ) +
        `MERGE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(coupon) as (keyof typeof coupon)[])
          .filter(key => coupon[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(coupon[key])}`
          ).join(',\n') + '\n' +
        `}) -[:FOR]-> (c)`
      )
    }
  }
}