import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import BlockPersistence from '../../src/persistence/block'

type Block = {
  amount: number
  payment?: number
  billPlzAttempt?: number
  transaction?: number
  time: Date
} & (
  | {
      type: 'top-up'
      to: BlockTarget
    }
  | {
      type: 'spent'
      from: BlockTarget
    }
  | {
      type: 'transfer'
      from: BlockTarget
      to: BlockTarget
    }
)
type BlockTarget = (
  | {
      type: 'store'
      balance: 'cash' | 'bank' | 'payment-gateway'
      store: string
    }
  | {
      type: 'user'
      balance: 'payment-gateway'
      user: string
    }
)
const blocks:Block[] = [{
  time: new Date('2020-10-28T03:48:15.441Z'),
  amount: 69,
  type: 'top-up',
  to: {
    type: 'user',
    balance: 'payment-gateway',
    user: 'Hao'
  }
}, {
  time: new Date('2020-10-28T03:50:45.441Z'),
  amount: 69,
  type: 'spent',
  from: {
    type: 'user',
    balance: 'payment-gateway',
    user: 'Hao'
  }
}, {
  time: new Date('2020-11-01T14:23:18.441Z'),
  amount: 39,
  type: 'top-up',
  to: {
    type: 'user',
    balance: 'payment-gateway',
    user: 'Hao'
  }
}]
export default class MockBlockPersistence extends BlockPersistence {
  initializeData = async(session:Session) => {
    const mapTarget = (target:BlockTarget, relationship:string) =>
      target.type === 'store'
        ? `MATCH (s:store) WHERE s.name = ${stringify(target.store)}\n` +
          `CREATE (b) -[:${relationship} {\n` +
          (Object.keys(target) as (keyof typeof target)[])
            .flatMap(key => key !== 'store' && key !== 'type'? [key]:[])
            .map(key =>
              `  ${key}: ${stringify(target[key])}`
            ).join(',\n') + '\n' +
          `}]-> (s)\n`
        : `MATCH (u:user) WHERE u.displayName = ${stringify(target.user)}\n` +
          `CREATE (b) -[:${relationship} {\n` +
          (Object.keys(target) as (keyof typeof target)[])
            .flatMap(key => key !== 'user' && key !== 'type'? [key]:[])
            .map(key =>
              `  ${key}: ${stringify(target[key])}`
            ).join(',\n') + '\n' +
          `}]-> (u)\n`
    for(const block of blocks) {
      await session.run(
        `CREATE (b:block {\n` +
        (Object.keys(block) as (keyof typeof block)[])
          .filter(key => !['payment', 'billPlzAttempt', 'transaction', 'to', 'from'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(block[key])}`
          ).join(',\n') + '\n' +
        `})\n` +
        (block.type === 'top-up' || block.type === 'transfer'
          ? `WITH b\n` +
            mapTarget(block.to, 'ADD_TO')
          : '') +
        (block.type === 'spent' || block.type === 'transfer'
          ? `WITH b\n` +
            mapTarget(block.from, 'MINUS_FROM')
          : '') +
        (block.payment
          ? `WITH b\n` +
            `MATCH (p:payment) WHERE ID(p) = ${block.payment}\n` +
            `CREATE (p) -[:RELATED_TO]-> (b)\n`
          : '') +
        (block.billPlzAttempt
          ? `WITH b\n` +
            `MATCH (bp:billPlzAttempt) WHERE ID(bp) = ${block.billPlzAttempt}\n` +
            `CREATE (bp) -[:RELATED_TO]-> (b)\n`
          : '') +
        (block.transaction
          ? `WITH b\n` +
            `MATCH (t:transaction) WHERE ID(t) = ${block.transaction}\n` +
            `CREATE (t) -[:RELATED_TO]-> (b)\n`
          : '')
      )
    }
  }
}