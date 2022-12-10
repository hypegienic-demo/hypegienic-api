import {Session} from 'neo4j-driver'

import {stringify} from '../../src/persistence'
import RequestPersistence, {OrdersRequest} from '../../src/persistence/request'

const ordersRequests:OrdersRequest[] = []
export default class MockRequestPersistence extends RequestPersistence {
  initializeData = async(session:Session) => {
    for(const ordersRequest of ordersRequests) {
      const mapOrder = (order:typeof ordersRequest.orders[0]) =>
        `WITH r\n` +
        `MERGE (o:order {\n` +
        (Object.keys(order) as (keyof typeof order)[])
          .filter(key => !['services', 'lockerUnitOpened'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(order[key])}`
          ).join(',\n') + '\n' +
        `}) <-[:CONTAIN]- (r)\n` +
        (order.type === 'locker'
          ? `WITH r, o\n` +
            `MATCH (lu:lockerUnit) WHERE ID(lu) = ${order.lockerUnitOpened}\n` +
            `MERGE (o) -[:OPENED]-> (lu)\n`
          : ''
        ) +
        order.services.map(service =>
          `WITH r, o\n` +
          `MATCH (s:service) WHERE ID(s) = ${service.id}\n` +
          `MERGE (o) -[:REQUIRE {\n` +
          (Object.keys(service) as (keyof typeof service)[])
            .filter(key => !['id'].includes(key))
            .map(key =>
              `  ${key}: ${stringify(service[key])}`
            ).join(',\n') + '\n' +
          `}]-> (s)\n`
        ).join('') +
        `WITH r, o\n` +
        `MERGE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        `  _requestor: ${ordersRequest.orderer},\n` +
        (Object.keys(order) as (keyof typeof order)[])
          .filter(key => order[key] !== undefined)
          .map(key =>
            `  _${key}: ${stringify(order[key])}`
          ).join(',\n') + '\n' +
        `}) -[:FOR]-> (o)\n`
      await session.run(
        `MERGE (r:request {\n` +
        (Object.keys(ordersRequest) as (keyof typeof ordersRequest)[])
          .filter(key => !['requestor', 'orderer', 'store', 'orders', 'products'].includes(key))
          .map(key =>
            `  ${key}: ${stringify(ordersRequest[key])}`
          ).join(',\n') + ',\n' +
        `  remark: ""\n` +
        `})\n` +
        `WITH r\n` +
        `MATCH (u:user) WHERE ID(u) = ${ordersRequest.orderer}\n` +
        `MERGE (r) <-[:ORDER]- (u)\n` +
        (ordersRequest.type === 'physical'
          ? `WITH r\n` +
            `MATCH (s:store) WHERE ID(s) = ${ordersRequest.store}\n` +
            `MERGE (r) -[:MADE_AT]-> (s)\n` +
            ordersRequest.products.map(product =>
              `WITH r\n` +
              `MATCH (p:product) WHERE ID(p) = ${product.id}\n` +
              `MERGE (r) -[:REQUIRE {\n` +
              (Object.keys(product) as (keyof typeof product)[])
                .filter(key => !['id'].includes(key))
                .map(key =>
                  `  ${key}: ${stringify(product[key])}`
                ).join(',\n') + '\n' +
              `}]-> (p)\n`
            ).join('')
          : '') +
        (ordersRequest.type === 'locker'
          ? ordersRequest.orders.map(mapOrder).join('')
          : ordersRequest.orders.map(mapOrder).join('')) +
        `WITH r\n` +
        `MERGE (e:event {\n` +
        `  type: "created",\n` +
        `  time: datetime(),\n` +
        (Object.keys(ordersRequest) as (keyof typeof ordersRequest)[])
          .filter(key => ordersRequest[key] !== undefined && !['orders'].includes(key))
          .map(key =>
            `  _${key}: ${stringify(ordersRequest[key])}`
          ).join(',\n') + '\n' +
        `}) -[:FOR]-> (r)`
      )
    }
  }

  fastForwardTime = async(minutes:number) => {
    await this.execute(
      `MATCH (e:event) WHERE EXISTS(e.time)\n` +
      `SET e.time = e.time - duration({minutes:${stringify(minutes)}})`
    )
  }
}