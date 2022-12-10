import {Persistence, stringify, resolveObject} from './'

class BlockPersistence extends Persistence { 
  protected snapshot:Record<string, number>
  constructor(host:string, authorized:{user:string, password:string}) {
    super(host, authorized)
    this.snapshot = {}
  }

  generateSnapshot = async():Promise<Record<string, number>> => {
    const blocks = await this.execute(
      `MATCH (b:block)\n` +
      `OPTIONAL MATCH (b) -[add:ADD_TO]-> (to)\n` +
      `OPTIONAL MATCH (b) -[minus:MINUS_FROM]-> (from)\n` +
      `RETURN b, ` +
      `CASE WHEN 'store' IN LABELS(to) ` +
      `THEN add {.*, type:'store', store:to} ELSE add {.*, type:'user', user:to} END AS to, ` +
      `CASE WHEN 'store' IN LABELS(from) ` +
      `THEN minus {.*, type:'store', store:from} ELSE minus {.*, type:'user', user:from} END AS from`
    ).then(result =>
      result.records.map(resolveObject) as PersistedBlock[]
    )
    const sortedBlocks = blocks.sort((blockA, blockB) =>
      blockA.time.getTime() - blockB.time.getTime()
    )
    this.snapshot = sortedBlocks.reduce(this.executeBlock, {} as Record<string, number>)
    return this.snapshot
  }
  protected getBlockId = (target:BlockTarget) =>
    target.type === 'store'
      ? `${target.store}-${target.balance}`
      : `${target.user}-${target.balance}`
  protected executeBlock = (snapshot:Record<string, number>, block:Block) => {
    switch(block.type) {
      case 'top-up': {
        const to = this.getBlockId(block.to)
        return {
          ...snapshot,
          [to]: (snapshot[to] ?? 0) + block.amount
        }
      }
      case 'spent': {
        const from = this.getBlockId(block.from)
        return {
          ...snapshot,
          [from]: (snapshot[from] ?? 0) - block.amount
        }
      }
      case 'transfer': {
        const to = this.getBlockId(block.to)
        const from = this.getBlockId(block.from)
        return to !== from 
          ? {
              ...snapshot,
              [to]: (snapshot[to] ?? 0) + block.amount,
              [from]: (snapshot[from] ?? 0) - block.amount
            }
          : snapshot
      }
    }
  }

  createBlock = (block:Block):Promise<number> => {
    const mapTarget = (target:BlockTarget, relationship:string) =>
      target.type === 'store'
        ? `MATCH (s:store) WHERE ID(s) = ${target.store}\n` +
          `CREATE (b) -[:${relationship} {\n` +
          (Object.keys(target) as (keyof typeof target)[])
            .flatMap(key => key !== 'store' && key !== 'type'? [key]:[])
            .map(key =>
              `  ${key}: ${stringify(target[key])}`
            ).join(',\n') + '\n' +
          `}]-> (s)\n`
        : `MATCH (u:user) WHERE ID(u) = ${target.user}\n` +
          `CREATE (b) -[:${relationship} {\n` +
          (Object.keys(target) as (keyof typeof target)[])
            .flatMap(key => key !== 'user' && key !== 'type'? [key]:[])
            .map(key =>
              `  ${key}: ${stringify(target[key])}`
            ).join(',\n') + '\n' +
          `}]-> (u)\n`
    return this.execute(
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
        : '') +
      `WITH b\n` +
      `OPTIONAL MATCH (b) -[add:ADD_TO]-> (to)\n` +
      `OPTIONAL MATCH (b) -[minus:MINUS_FROM]-> (from)\n` +
      `RETURN b, ` +
      `CASE WHEN 'store' IN LABELS(to) ` +
      `THEN add {.*, type:'store', store:to} ELSE add {.*, type:'user', user:to} END AS to, ` +
      `CASE WHEN 'store' IN LABELS(from) ` +
      `THEN minus {.*, type:'store', store:from} ELSE minus {.*, type:'user', user:from} END AS from`
    ).then(result => {
      const block:PersistedBlock = resolveObject(result.records[0] as any)
      this.snapshot = this.executeBlock(this.snapshot, block)
      return this.snapshot[this.getBlockId(
        block.type === 'spent' || block.type === 'transfer'
          ? block.from
          : block.to
      )] as number
    })
  }
  getCurrentAmount = (target:BlockTarget):number => {
    return this.snapshot[this.getBlockId(target)] ?? 0
  }
  getTotalAmount = (balance:'cash' | 'bank' | 'payment-gateway'):number => {
    return Object.keys(this.snapshot)
      .filter(target => target.endsWith(balance))
      .reduce((total, target) => total + (this.snapshot[target] as number), 0)
  }
}
export type Block = {
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
      store: number
    }
  | {
      type: 'user'
      balance: 'payment-gateway'
      user: number
    }
)
export type PersistedBlock = Block & {
  id: number
}
export default BlockPersistence