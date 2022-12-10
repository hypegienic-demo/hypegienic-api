import {Payment, PersistedPayment} from './transaction'
import CouponPersistence, {calculateServiceProductPrice} from './coupon'
import {Persistence, stringify, parse, resolveObject} from './'

class RequestPersistence extends Persistence {
  protected queue:{
    promise: Promise<() => void>
    resolve: () => void
  }[]
  constructor(host:string, authorized:{user:string, password:string}) {
    super(host, authorized)
    this.queue = []
  }

  createInvoiceId = async():Promise<{
    invoiceId: number
    unlock: () => void
  }> => {
    let resolve:() => void = () => {}
    const promise = new Promise<() => void>(done => {
      resolve = () => done(() => {
        this.queue = this.queue.slice(1)
        this.queue[0]?.resolve()
      })
    })
    if(this.queue.length === 0) resolve()
    this.queue.push({
      promise,
      resolve
    })
    const unlock = await promise
    const invoiceId = await this.execute(
      `MATCH (r:request)\n` +
      `RETURN CASE WHEN COUNT(r) > 0\n` +
      `THEN MAX(r.invoiceId) + 1\n` +
      `ELSE 1\n` +
      `END`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
    return {
      invoiceId,
      unlock
    }
  }
  createRequest = (request: Pick<BaseOrdersRequestParameter, 'status' | 'invoiceId' | 'orderer' | 'coupon'> & {requestor:number} & (
    | {type:'locker', orders:[Extract<LockerOrder, {status:'opened-locker'}>]}
    | {type:'physical', store:number, orders:Extract<PhysicalOrder, {status:'deposited'}>[], products:ProductOrder[]}
  )):Promise<PersistedOrdersRequest> => {
    const mapOrder = (order:typeof request.orders[0]) =>
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
      `  _requestor: ${request.requestor},\n` +
      (Object.keys(order) as (keyof typeof order)[])
        .filter(key => order[key] !== undefined)
        .map(key =>
          `  _${key}: ${stringify(order[key])}`
        ).join(',\n') + '\n' +
      `}) -[:FOR]-> (o)\n`
    return this.execute(
      `MERGE (r:request {\n` +
      (Object.keys(request) as (keyof typeof request)[])
        .filter(key => !['requestor', 'orderer', 'store', 'orders', 'products', 'coupon'].includes(key))
        .map(key =>
          `  ${key}: ${stringify(request[key])}`
        ).join(',\n') + ',\n' +
      `  remark: ""\n` +
      `})\n` +
      (request.coupon
        ? `WITH r\n` +
          `MATCH (c:coupon) WHERE ${stringify(request.coupon)} IN c.codes\n` +
          `MERGE (r) -[:USED {code:${stringify(request.coupon)}}]-> (c)\n`
        : '') +
      `WITH r\n` +
      `MATCH (u:user) WHERE ID(u) = ${request.orderer}\n` +
      `MERGE (r) <-[:ORDER]- (u)\n` +
      (request.type === 'physical'
        ? `WITH r\n` +
          `MATCH (s:store) WHERE ID(s) = ${request.store}\n` +
          `MERGE (r) -[:MADE_AT]-> (s)\n` +
          request.products.map(product =>
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
      (request.type === 'locker'
        ? request.orders.map(mapOrder).join('')
        : request.orders.map(mapOrder).join('')) +
      `WITH r\n` +
      `MERGE (e:event {\n` +
      `  type: "created",\n` +
      `  time: datetime(),\n` +
      (Object.keys(request) as (keyof typeof request)[])
        .filter(key => request[key] !== undefined && !['orders'].includes(key))
        .map(key =>
          `  _${key}: ${stringify(request[key])}`
        ).join(',\n') + '\n' +
      `}) -[:FOR]-> (r)\n` +
      `WITH r, e\n` +
      `OPTIONAL MATCH (r) -[coupon:USED]-> (:coupon)\n` +
      `OPTIONAL MATCH (r) <-[:ORDER]- (orderer:user)\n` +
      `OPTIONAL MATCH (r) -[:MADE_AT]-> (store:store)\n` +
      `OPTIONAL MATCH (r) -[req:REQUIRE]-> (product:product)\n` +
      `OPTIONAL MATCH (r) -[:CONTAIN]-> (order:order)\n` +
      `WITH r, e.time AS time, coupon.code AS coupon, orderer, store, order,\n` +
      `COLLECT(product {` +
      `  id: ID(product),\n` +
      `  quantity: req.quantity,\n` +
      `  price: req.price\n` +
      `}) AS products\n` +
      `OPTIONAL MATCH (order) -[:OPENED]-> (luo:lockerUnit)\n` +
      `OPTIONAL MATCH (order) -[req:REQUIRE]-> (s:service)\n` +
      `OPTIONAL MATCH (order) <-[:FOR]- (e:event)\n` +
      `WITH r, time, coupon, orderer, store, products, order {\n` +
      `  .*,\n` +
      `  id: ID(order),\n` +
      `  time: MAX(e.time),\n` +
      `  lockerUnitOpened: luo,\n` +
      `  services: COLLECT(DISTINCT s {\n` +
      `    id: ID(s),\n` +
      `    done: req.done,\n` +
      `    price: req.price\n` +
      `  })\n` +
      `} AS o\n` +
      `RETURN r, time, coupon, orderer, store, [] AS payments, products, COLLECT(o) AS orders`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }
  updateRequest = (
    where: {
      requestId?: number
    },
    request: {requestor:number} & (
      | {
          status: 'attach-coupon'
          coupon: string
        }
      | {
          status: 'product-updated'
          products: ProductOrder[]
        }
      | {
          status: 'payment-made'
          payment: Payment
        }
      | {
          status: 'remark-updated'
          remark: string
        }
      | {
          status: 'pickup-time-updated'
          time: Date
        }
      | {
          status: 'request-cancelled'
        }
    )
  ):Promise<PersistedOrdersRequest> => {
    let query:string = ''
    if(where.requestId !== undefined) query += `WHERE ID(r) = ${where.requestId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (r:request)\n` +
        query +
        (request.status === 'attach-coupon'
          ? `WITH r\n` +
            `MATCH (c:coupon) WHERE ${stringify(request.coupon)} IN c.codes\n` +
            `CREATE (r) -[:USED {code:${stringify(request.coupon)}}]-> (c)\n`
          : '') +
        (request.status === 'product-updated'
          ? `WITH r\n` +
            `OPTIONAL MATCH (r) -[req:REQUIRE]-> (:product)\n` +
            `DELETE req\n` +
            request.products.map(product =>
              `WITH r\n` +
              `MATCH (p:product)\n` +
              `WHERE ID(p) = ${product.id}\n` +
              `CREATE (r) -[:REQUIRE {\n` +
              (Object.keys(product) as (keyof typeof product)[])
                .filter(key => !['id'].includes(key))
                .map(key =>
                  `  ${key}: ${stringify(product[key])}`
                ).join(',\n') + '\n' +
              `}]-> (p)\n`
            ).join('')
          : '') +
        (request.status === 'payment-made'
          ? `WITH r\n` +
            `CREATE (:payment {\n` +
            (Object.keys(request.payment) as (keyof typeof request.payment)[])
              .map(key =>
                `  ${key}: ${stringify(request.payment[key])}`
              ).join(',\n') + '\n' +
            `}) -[:PAID]-> (r)\n`
          : '') +
        (request.status === 'remark-updated'
          ? `WITH r\n` +
            `SET r.remark = ${stringify(request.remark)}\n`
          : '') +
        (request.status === 'pickup-time-updated'
          ? `WITH r\n` +
            `SET r.pickUpTime = ${stringify(request.time)}\n`
          : '') +
        (request.status === 'request-cancelled'
          ? `WITH r\n` +
            `SET r.status = "cancelled"\n`
          : '') +
        `WITH r\n` +
        `CREATE (e:event {\n` +
        `  type: "updated",\n` +
        `  time: datetime(),\n` +
        (Object.keys(request) as (keyof typeof request)[])
          .filter(key => request[key] !== undefined && !['status'].includes(key))
          .map(key =>
            `  _${key}: ${stringify(request[key])}`
          ).join(',\n') + '\n' +
        `}) -[:FOR]-> (r)\n` +
        `WITH r\n` +
        `OPTIONAL MATCH (r) <-[:FOR]- (e:event)\n` +
        `WITH r, MAX(e.time) AS time\n` +
        `OPTIONAL MATCH (r) -[coupon:USED]-> (:coupon)\n` +
        `OPTIONAL MATCH (r) <-[:ORDER]- (orderer:user)\n` +
        `OPTIONAL MATCH (r) -[:MADE_AT]-> (store:store)\n` +
        `OPTIONAL MATCH (r) <-[:PAID]- (p:payment)\n` +
        `OPTIONAL MATCH (r) -[req:REQUIRE]-> (product:product)\n` +
        `OPTIONAL MATCH (r) -[:CONTAIN]-> (order:order)\n` +
        `WITH r, time, coupon.code AS coupon, orderer, store, COLLECT(p {.*, id:ID(p)}) AS payments, order,\n` +
        `COLLECT(product {` +
        `  id: ID(product),\n` +
        `  quantity: req.quantity,\n` +
        `  price: req.price\n` +
        `}) AS products\n` +
        `OPTIONAL MATCH (order) -[:OPENED]-> (luo:lockerUnit)\n` +
        `OPTIONAL MATCH (order) -[:DELIVERED]-> (lud:lockerUnit)\n` +
        `OPTIONAL MATCH (order) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (order) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (order) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `OPTIONAL MATCH (order) <-[:FOR]- (e:event)\n` +
        `WITH r, time, coupon, orderer, store, payments, products,\n` +
        `order {\n` +
        `  .*,\n` +
        `  id: ID(order),\n` +
        `  time: MAX(e.time),\n` +
        `  lockerUnitOpened: luo,\n` +
        `  lockerUnitDelivered: lud,\n` +
        `  services: COLLECT(DISTINCT s {\n` +
        `    id: ID(s),\n` +
        `    done: req.done,\n` +
        `    price: req.price\n` +
        `  }),\n` +
        `  imagesBefore: COLLECT(DISTINCT bi),\n` +
        `  imagesAfter: COLLECT(DISTINCT ai)\n` +
        `} AS o\n` +
        `RETURN r, time, coupon, orderer, store, payments, products, COLLECT(o) AS orders`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing request query parameter')
    }
  }
  getRequest = (where: {
    requestId?: number
    orderId?: number
  }):Promise<PersistedOrdersRequest> => {
    let query:string = ''
    if(where.requestId !== undefined) query += `WHERE ID(r) = ${where.requestId}\n`
    if(where.orderId !== undefined) query +=
      `WITH r\n` +
      `MATCH (o:order) WHERE ID(o) = ${where.orderId}\n` +
      `MATCH (o) <-[:CONTAIN]- (r)\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (r:request)\n` +
        query +
        `WITH r\n` +
        `OPTIONAL MATCH (r) <-[:FOR]- (e:event)\n` +
        `WITH r, MAX(e.time) AS time\n` +
        `OPTIONAL MATCH (r) -[coupon:USED]-> (:coupon)\n` +
        `OPTIONAL MATCH (r) <-[:ORDER]- (orderer:user)\n` +
        `OPTIONAL MATCH (r) -[:MADE_AT]-> (store:store)\n` +
        `OPTIONAL MATCH (r) <-[:PAID]- (p:payment)\n` +
        `OPTIONAL MATCH (r) -[req:REQUIRE]-> (product:product)\n` +
        `OPTIONAL MATCH (r) -[:CONTAIN]-> (order:order)\n` +
        `WITH r, time, coupon.code AS coupon, orderer, store, COLLECT(p {.*, id:ID(p)}) AS payments, order,\n` +
        `COLLECT(product {` +
        `  id: ID(product),\n` +
        `  quantity: req.quantity,\n` +
        `  price: req.price\n` +
        `}) AS products\n` +
        `OPTIONAL MATCH (order) -[:OPENED]-> (luo:lockerUnit)\n` +
        `OPTIONAL MATCH (order) -[:DELIVERED]-> (lud:lockerUnit)\n` +
        `OPTIONAL MATCH (order) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (order) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (order) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `OPTIONAL MATCH (order) <-[:FOR]- (e:event)\n` +
        `WITH r, time, coupon, orderer, store, payments, products,\n` +
        `order {\n` +
        `  .*,\n` +
        `  id: ID(order),\n` +
        `  time: MAX(e.time),\n` +
        `  lockerUnitOpened: luo,\n` +
        `  lockerUnitDelivered: lud,\n` +
        `  services: COLLECT(DISTINCT s {\n` +
        `    id: ID(s),\n` +
        `    done: req.done,\n` +
        `    price: req.price\n` +
        `  }),\n` +
        `  imagesBefore: COLLECT(DISTINCT bi),\n` +
        `  imagesAfter: COLLECT(DISTINCT ai)\n` +
        `} AS o\n` +
        `RETURN r, time, coupon, orderer, store, payments, products, COLLECT(o) AS orders`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing request query parameter')
    }
  }
  getRequests = (where: {
    type?: 'locker' | 'physical'
    ordererId?: number
    statuses?: (LockerOrder | PhysicalOrder)['status'][]
    lockerId?: number
    lastUpdated?: Date
  }):Promise<PersistedOrdersRequest[]> => {
    let query:string = ''
    if(where.type !== undefined) query += `WHERE r.type = ${stringify(where.type)}\n`
    if(where.ordererId !== undefined) query +=
      `WITH r\n` +
      `MATCH (u:user) WHERE ID(u) = ${where.ordererId}\n` +
      `WITH r, u\n` +
      `WHERE (r) <-[:ORDER]- (u)\n`
    if(where.statuses !== undefined) query +=
      `WITH r\n` +
      `MATCH (o:order) WHERE o.status IN ${stringify(where.statuses)}\n` +
      `WITH r, o\n` +
      `WHERE (r) -[:CONTAIN]-> (o)\n`
    if(where.lockerId !== undefined) query +=
      `WITH r\n` +
      `MATCH (l:locker) WHERE ID(l) = ${where.lockerId}\n` +
      `WITH r, l\n` +
      `WHERE (r) -[:CONTAIN]-> (:order) -[:OPENED]-> (:lockerUnit) <-[:HOUSE]- (l)\n` +
      `OR (r) -[:CONTAIN]-> (:order) -[:DELIVERED]-> (:lockerUnit) <-[:HOUSE]- (l)\n`
    if(where.lastUpdated !== undefined) query +=
      `WITH r\n` +
      `OPTIONAL MATCH (e:event) WHERE (e) -[:FOR]-> (r)\n` +
      `OR (e) -[:FOR]-> (:order) <-[:CONTAIN]- (r)\n` +
      `WITH r, MAX(e.time) AS lastUpdated\n` +
      `WHERE lastUpdated >= ${stringify(where.lastUpdated)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (r:request)\n` +
        query +
        `WITH r\n` +
        `OPTIONAL MATCH (r) <-[:FOR]- (e:event)\n` +
        `WITH r, MAX(e.time) AS time\n` +
        `OPTIONAL MATCH (r) -[coupon:USED]-> (:coupon)\n` +
        `OPTIONAL MATCH (r) <-[:ORDER]- (orderer:user)\n` +
        `OPTIONAL MATCH (r) -[:MADE_AT]-> (store:store)\n` +
        `OPTIONAL MATCH (r) <-[:PAID]- (p:payment)\n` +
        `OPTIONAL MATCH (r) -[req:REQUIRE]-> (product:product)\n` +
        `OPTIONAL MATCH (r) -[:CONTAIN]-> (order:order)\n` +
        `WITH r, time, coupon.code AS coupon, orderer, store, COLLECT(p {.*, id:ID(p)}) AS payments, order,\n` +
        `COLLECT(product {` +
        `  id: ID(product),\n` +
        `  quantity: req.quantity,\n` +
        `  price: req.price\n` +
        `}) AS products\n` +
        `OPTIONAL MATCH (order) -[:OPENED]-> (luo:lockerUnit)\n` +
        `OPTIONAL MATCH (order) -[:DELIVERED]-> (lud:lockerUnit)\n` +
        `OPTIONAL MATCH (order) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (order) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (order) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `OPTIONAL MATCH (order) <-[:FOR]- (e:event)\n` +
        `WITH r, time, coupon, orderer, store, payments, products,\n` +
        `order {\n` +
        `  .*,\n` +
        `  id: ID(order),\n` +
        `  time: MAX(e.time),\n` +
        `  lockerUnitOpened: luo,\n` +
        `  lockerUnitDelivered: lud,\n` +
        `  services: COLLECT(DISTINCT s {\n` +
        `    id: ID(s),\n` +
        `    done: req.done,\n` +
        `    price: req.price\n` +
        `  }),\n` +
        `  imagesBefore: COLLECT(DISTINCT bi),\n` +
        `  imagesAfter: COLLECT(DISTINCT ai)\n` +
        `} AS o\n` +
        `RETURN r, time, coupon, orderer, store, payments, products, COLLECT(o) AS orders`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing request query parameter')
    }
  }
  getIncompleteRequests = ():Promise<PersistedOrdersRequest[]> => {
    return this.execute(
      `MATCH (r:request)\n` +
      `WHERE r.status <> "cancelled"\n` +
      `WITH r\n` +
      `OPTIONAL MATCH (r) -[preq:REQUIRE]-> (:product)\n` +
      `OPTIONAL MATCH (r) -[:CONTAIN]-> (order:order) -[sreq:REQUIRE]-> (:service)\n` +
      `WITH r, COLLECT(order) AS orders, ` +
      `REDUCE(totalProductCost = 0, req IN COLLECT(preq) | totalProductCost + req.quantity * req.price) + ` +
      `REDUCE(totalServiceCost = 0, req IN COLLECT(sreq) | totalServiceCost + req.price) AS cost\n` +
      `OPTIONAL MATCH (r) <-[:PAID]- (p:payment)\n` +
      `WITH r, orders, cost, SUM(p.amount) AS paid\n` +
      `WHERE ANY(order IN orders WHERE NOT order.status IN ["cancelled", "retrieved-back"]) OR cost > paid\n` +
      `WITH r\n` +
      `OPTIONAL MATCH (r) <-[:FOR]- (e:event)\n` +
      `WITH r, MAX(e.time) AS time\n` +
      `OPTIONAL MATCH (r) -[coupon:USED]-> (:coupon)\n` +
      `OPTIONAL MATCH (r) <-[:ORDER]- (orderer:user)\n` +
      `OPTIONAL MATCH (r) -[:MADE_AT]-> (store:store)\n` +
      `OPTIONAL MATCH (r) <-[:PAID]- (p:payment)\n` +
      `OPTIONAL MATCH (r) -[req:REQUIRE]-> (product:product)\n` +
      `OPTIONAL MATCH (r) -[:CONTAIN]-> (order:order)\n` +
      `WITH r, time, coupon.code AS coupon, orderer, store, COLLECT(p {.*, id:ID(p)}) AS payments, order,\n` +
      `COLLECT(product {` +
      `  id: ID(product),\n` +
      `  quantity: req.quantity,\n` +
      `  price: req.price\n` +
      `}) AS products\n` +
      `OPTIONAL MATCH (order) -[:OPENED]-> (luo:lockerUnit)\n` +
      `OPTIONAL MATCH (order) -[:DELIVERED]-> (lud:lockerUnit)\n` +
      `OPTIONAL MATCH (order) -[req:REQUIRE]-> (s:service)\n` +
      `OPTIONAL MATCH (order) <-[:BEFORE_IMAGE]- (bi:file)\n` +
      `OPTIONAL MATCH (order) <-[:AFTER_IMAGE]- (ai:file)\n` +
      `OPTIONAL MATCH (order) <-[:FOR]- (e:event)\n` +
      `WITH r, time, coupon, orderer, store, payments, products,\n` +
      `order {\n` +
      `  .*,\n` +
      `  id: ID(order),\n` +
      `  time: MAX(e.time),\n` +
      `  lockerUnitOpened: luo,\n` +
      `  lockerUnitDelivered: lud,\n` +
      `  services: COLLECT(DISTINCT s {\n` +
      `    id: ID(s),\n` +
      `    done: req.done,\n` +
      `    price: req.price\n` +
      `  }),\n` +
      `  imagesBefore: COLLECT(DISTINCT bi),\n` +
      `  imagesAfter: COLLECT(DISTINCT ai)\n` +
      `} AS o\n` +
      `RETURN r, time, coupon, orderer, store, payments, products, COLLECT(o) AS orders`
    ).then(result =>
      result.records.map(resolveObject)
    )
  }

  getRequestEvents = (where: {
    requestId?: number
  }):Promise<PersistedOrdersRequestEvent[]> => {
    let query:string = ''
    if(where.requestId !== undefined) query += `WHERE ID(r) = ${where.requestId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (r:request)\n` +
        query +
        `WITH r\n` +
        `OPTIONAL MATCH (r) <-[:FOR]- (e:event)\n` +
        `RETURN e`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing request query parameter')
    }
  }

  updateOrder = (
    where: {
      orderId?: number
    },
    order: {requestor:number} & (
      | ({type:'locker', status:'deposited'} & BaseOrderDepositParameter)
      | ({type:'locker', status:'retrieved-store'} & BaseOrderRetrieveStoreParameter)
      | ({type:'locker' | 'physical', status:'delivered-store'} & BaseOrderDeliverStoreParameter)
      | ({type:'locker' | 'physical', status:'service-updated'} & {services:{id:number, price:number, done:boolean}[]})
      | ({type:'locker' | 'physical', status:'cleaned'} & BaseOrderCleanParameter)
      | ({type:'locker', status:'delivered-back'} & BaseOrderLockerDeliverBackParameter)
      | ({type:'locker' | 'physical', status:'retrieved-back'} & BaseOrderRetrieveBackParameter)
      | ({type:'locker' | 'physical', status:'cancelled'})
    )
  ):Promise<PersistedLockerOrder | PersistedPhysicalOrder> => {
    let query:string = ''
    if(where.orderId !== undefined) query += `WHERE ID(o) = ${where.orderId}\n`
    const statuses = [
      'opened-locker',
      'deposited',
      'retrieved-store',
      'delivered-store',
      'cleaned',
      'delivered-back',
      'retrieved-back',
      'cancelled'
    ]

    if(query.length > 0) {
      return this.execute(
        `MATCH (o:order)\n` +
        query +
        (Object.keys(order) as (keyof typeof order)[])
          .filter(key => ['name', 'type', 'status'].includes(key))
          .map(key =>
            key === 'status' && !statuses.includes(order.status)
              ? ``
              : `SET o.${key} = ${stringify(order[key])}\n`
          ).join('') +
        (order.status === 'delivered-store'
          ? `WITH o\n` +
            `OPTIONAL MATCH (o) <-[i:BEFORE_IMAGE]- (f:file)\n` +
            `DELETE i\n` +
            `WITH o\n` +
            `MATCH (f:file)\n` +
            `WHERE ID(f) IN ${stringify(order.imagesBefore)}\n` +
            `MERGE (f) -[:BEFORE_IMAGE]-> (o)\n`
          : '') +
        (order.status === 'service-updated'
          ? `WITH o\n` +
            `OPTIONAL MATCH (o) -[req:REQUIRE]-> (:service)\n` +
            `DELETE req\n` +
            order.services.map(service =>
              `WITH o\n` +
              `MATCH (s:service)\n` +
              `WHERE ID(s) = ${service.id}\n` +
              `MERGE (o) -[:REQUIRE {\n` +
              (Object.keys(service) as (keyof typeof service)[])
                .filter(key => !['id'].includes(key))
                .map(key =>
                  `  ${key}: ${stringify(service[key])}`
                ).join(',\n') + '\n' +
              `}]-> (s)\n`
            ).join('')
          : '') +
        (order.status === 'cleaned'
          ? `WITH o\n` +
            `OPTIONAL MATCH (o) <-[i:AFTER_IMAGE]- (f:file)\n` +
            `DELETE i\n` +
            `WITH o\n` +
            `MATCH (f:file)\n` +
            `WHERE ID(f) IN ${stringify(order.imagesAfter)}\n` +
            `MERGE (f) -[:AFTER_IMAGE]-> (o)\n`
          : '') +
        (order.status === 'delivered-back'
          ? `WITH o\n` +
            `OPTIONAL MATCH (lu:lockerUnit) <-[d:DELIVERED]- (o)\n` +
            `DELETE d\n` +
            `WITH o\n` +
            `MATCH (lu:lockerUnit)\n` +
            `WHERE ID(lu) = ${order.lockerUnitDelivered}\n` +
            `CREATE (lu) <-[:DELIVERED]- (o)\n`
          : '') +
        `MERGE (e:event {\n` +
        `  type: "updated",\n` +
        `  time: datetime(),\n` +
        (Object.keys(order) as (keyof typeof order)[])
          .filter(key =>
            order[key] !== undefined &&
            (key !== 'status' || statuses.includes(order[key]))
          )
          .map(key =>
            `  _${key}: ${stringify(order[key])}`
          )
          .join(',\n') + '\n' +
        `})\n` +
        `MERGE (e) -[:FOR]-> (o)\n` +
        `WITH o, e\n` +
        `OPTIONAL MATCH (o) -[:OPENED]-> (lockerUnitOpened:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[:DELIVERED]-> (lockerUnitDelivered:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (o) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (o) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `RETURN o, MAX(e.time) AS time, lockerUnitOpened, lockerUnitDelivered,\n` +
        `COLLECT(DISTINCT s {\n` +
        `  id: ID(s),\n` +
        `  done: req.done,\n` +
        `  price: req.price\n` +
        `}) AS services,\n` +
        `COLLECT(DISTINCT bi) AS imagesBefore,\n` +
        `COLLECT(DISTINCT ai) AS imagesAfter`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing order query parameter')
    }
  }
  getOrder = (where: {
    orderId?: number
  }):Promise<PersistedLockerOrder | PersistedPhysicalOrder> => {
    let query:string = ''
    if(where.orderId !== undefined) query += `WHERE ID(o) = ${where.orderId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (o:order)\n` +
        query +
        `WITH o\n` +
        `OPTIONAL MATCH (o) -[:OPENED]-> (lockerUnitOpened:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[:DELIVERED]-> (lockerUnitDelivered:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (o) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (o) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `OPTIONAL MATCH (o) <-[:FOR]- (e:event)\n` +
        `RETURN o, MAX(e.time) AS time, lockerUnitOpened, lockerUnitDelivered,\n` +
        `COLLECT(DISTINCT s {\n` +
        `  id: ID(s),\n` +
        `  done: req.done,\n` +
        `  price: req.price\n` +
        `}) AS services,\n` +
        `COLLECT(DISTINCT bi) AS imagesBefore,\n` +
        `COLLECT(DISTINCT ai) AS imagesAfter`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing order query parameter')
    }
  }
  getOrders = (where: {
    type?: 'locker' | 'physical'
    ordererId?: number
    statuses?: (LockerOrder | PhysicalOrder)['status'][]
    lockerId?: number
    lastUpdated?: Date
  }):Promise<(PersistedLockerOrder | PersistedPhysicalOrder)[]> => {
    let query:string = ''
    if(where.type !== undefined) query += `WHERE o.type = ${stringify(where.type)}\n`
    if(where.ordererId !== undefined) query +=
      `WITH o\n` +
      `MATCH (u:user) WHERE ID(u) = ${where.ordererId}\n` +
      `WITH o, u\n` +
      `WHERE (o) <-[:CONTAIN]- (:request) <-[:ORDER]- (u)\n`
    if(where.statuses !== undefined) query +=
      `WITH o\n` +
      `WHERE o.status IN ${stringify(where.statuses)}\n`
    if(where.lockerId !== undefined) query +=
      `WITH o\n` +
      `MATCH (l:locker) WHERE ID(l) = ${where.lockerId}\n` +
      `WITH o, l\n` +
      `WHERE (o) -[:OPENED]-> (:lockerUnit) <-[:HOUSE]- (l) OR (o) -[:DELIVERED]-> (:lockerUnit) <-[:HOUSE]- (l)\n`
    if(where.lastUpdated !== undefined) query +=
      `WITH o\n` +
      `OPTIONAL MATCH (o) <-[:FOR]- (e:event)\n` +
      `WITH o, MAX(e.time) AS time\n` +
      `WHERE MAX(e.time) >= ${stringify(where.lastUpdated)}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (o:order)\n` +
        query +
        `WITH o\n` +
        `OPTIONAL MATCH (o) -[:OPENED]-> (lockerUnitOpened:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[:DELIVERED]-> (lockerUnitDelivered:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (o) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (o) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `OPTIONAL MATCH (o) <-[:FOR]- (e:event)\n` +
        `RETURN o, MAX(e.time) AS time, lockerUnitOpened, lockerUnitDelivered,\n` +
        `COLLECT(DISTINCT s {\n` +
        `  id: ID(s),\n` +
        `  done: req.done,\n` +
        `  price: req.price\n` +
        `}) AS services,\n` +
        `COLLECT(DISTINCT bi) AS imagesBefore,\n` +
        `COLLECT(DISTINCT ai) AS imagesAfter`
      ).then(result => 
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing order query parameter')
    }
  }

  getOrderEvents = (where: {
    orderId?: number
  }):Promise<PersistedOrderEvent[]> => {
    let query:string = ''
    if(where.orderId !== undefined) query += `WHERE ID(o) = ${where.orderId}\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (o:order)\n` +
        query +
        `WITH o\n` +
        `OPTIONAL MATCH (o) <-[:FOR]- (e:event)\n` +
        `RETURN e`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing order query parameter')
    }
  }
  revertOrderEvent = async(eventId:number, reverterId:number):Promise<PersistedLockerOrder | PersistedPhysicalOrder> => {
    const order:(PersistedLockerOrder | PersistedPhysicalOrder) & {
      events: PersistedOrderEvent[]
    } = await this.execute(
      `MATCH (o:order) <-[:FOR]- (e:event)\n` +
      `WHERE ID(e) = ${eventId}\n` +
      `WITH o\n` +
      `OPTIONAL MATCH (o) -[:OPENED]-> (lockerUnitOpened:lockerUnit)\n` +
      `OPTIONAL MATCH (o) -[:DELIVERED]-> (lockerUnitDelivered:lockerUnit)\n` +
      `OPTIONAL MATCH (o) -[req:REQUIRE]-> (s:service)\n` +
      `OPTIONAL MATCH (o) <-[:BEFORE_IMAGE]- (bi:file)\n` +
      `OPTIONAL MATCH (o) <-[:AFTER_IMAGE]- (ai:file)\n` +
      `OPTIONAL MATCH (o) <-[:FOR]- (e:event)\n` +
      `WITH o, lockerUnitOpened, lockerUnitDelivered, s, req, bi, ai, e ORDER BY e.time\n` +
      `RETURN o, MAX(e.time) AS time, lockerUnitOpened, lockerUnitDelivered,\n` +
      `COLLECT(DISTINCT s {\n` +
      `  id: ID(s),\n` +
      `  done: req.done,\n` +
      `  price: req.price\n` +
      `}) AS services,\n` +
      `COLLECT(DISTINCT bi) AS imagesBefore,\n` +
      `COLLECT(DISTINCT ai) AS imagesAfter,\n` +
      `COLLECT(DISTINCT e {.*, id:ID(e)}) AS events`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
    const revertingEvent = order.events.find(event => event.id === eventId)

    if(revertingEvent) {
      const previousEvents = order.events.filter(event =>
        event.type !== 'reverted' &&
        event.time.getTime() < revertingEvent.time.getTime()
      )
      const revertedEvents = order.events.filter(event =>
        event.type !== 'reverted' &&
        event.time.getTime() >= revertingEvent.time.getTime()
      )
      const toBeUpdated = revertedEvents
        .flatMap(event => Object.keys(event) as (keyof typeof revertingEvent)[])
        .filter((key, index, keys) => keys.indexOf(key) === index)
        .filter(key => key.startsWith('_') && key !== '_requestor' && revertingEvent[key] !== undefined)
        .reduce<Partial<typeof revertingEvent>>((order, key) => ({
          ...order,
          [key]: previousEvents
            .map(event => event[key])
            .filter(value => value !== undefined)
            .splice(-1)[0]
        }), {})
      return this.execute(
        `MATCH (o:order) <-[:FOR]- (e:event)\n` +
        `WHERE ID(e) IN ${stringify(revertedEvents.map(event => event.id))}\n` +
        `SET e.type = "reverted"\n` +
        `SET e._reverter = ${reverterId}\n` +
        `WITH o\n` +
        (Object.keys(toBeUpdated) as (keyof typeof revertingEvent)[])
          .map(key =>
            ['_name', '_type', '_status'].includes(key)
              ? `SET o.${key.replace(/^_/, '')} = ${stringify(toBeUpdated[key])}\n`
              : key === '_services'
              ? `WITH o\n` +
                `OPTIONAL MATCH (o) -[req:REQUIRE]-> (:service)\n` +
                `DELETE req\n` +
                (toBeUpdated[key]
                  ? (toBeUpdated[key] as string[])
                      .map(service => parse(service) as BaseOrderParameter['services'][0])
                      .map(service =>
                        `WITH o\n` +
                        `MATCH (s:service)\n` +
                        `WHERE ID(s) = ${service.id}\n` +
                        `MERGE (o) -[:REQUIRE {\n` +
                        (Object.keys(service) as (keyof typeof service)[])
                          .filter(key => !['id'].includes(key))
                          .map(key =>
                            `  ${key}: ${stringify(service[key])}`
                          ).join(',\n') + '\n' +
                        `}]-> (s)\n`
                      )
                      .join('')
                  : '')
              : key === '_lockerUnitOpened'
              ? `WITH o\n` +
                `OPTIONAL MATCH (luo:lockerUnit) <-[l:OPENED]- (o)\n` +
                `DELETE l\n` +
                (toBeUpdated[key]
                  ? `WITH o\n` +
                    `MATCH (lu:lockerUnit)\n` +
                    `WHERE ID(lu) = ${toBeUpdated[key]}\n` +
                    `CREATE (lu) <-[:OPENED]- (o)\n`
                  : '')
              : key === '_lockerUnitDelivered'
              ? `WITH o\n` +
                `OPTIONAL MATCH (luo:lockerUnit) <-[l:DELIVERED]- (o)\n` +
                `DELETE l\n` +
                (toBeUpdated[key]
                  ? `WITH o\n` +
                    `MATCH (lu:lockerUnit)\n` +
                    `WHERE ID(lu) = ${toBeUpdated[key]}\n` +
                    `CREATE (lu) <-[:DELIVERED]- (o)\n`
                  : '')
              : key === '_imagesBefore'
              ? `WITH o\n` +
                `OPTIONAL MATCH (o) <-[i:BEFORE_IMAGE]- (f:file)\n` +
                `DELETE i\n` +
                (toBeUpdated[key]
                  ? `WITH o\n` +
                    `MATCH (f:file)\n` +
                    `WHERE ID(f) IN ${stringify(toBeUpdated[key])}\n` +
                    `MERGE (f) -[:BEFORE_IMAGE]-> (o)\n`
                  : '')
              : key === '_imagesAfter'
              ? `WITH o\n` +
                `OPTIONAL MATCH (o) <-[i:AFTER_IMAGE]- (f:file)\n` +
                `DELETE i\n` +
                (toBeUpdated[key]
                  ? `WITH o\n` +
                    `MATCH (f:file)\n` +
                    `WHERE ID(f) IN ${stringify(toBeUpdated[key])}\n` +
                    `MERGE (f) -[:AFTER_IMAGE]-> (o)\n`
                  : '')
              : ''
          ).join('') +
        `WITH o\n` +
        `OPTIONAL MATCH (o) -[:OPENED]-> (lockerUnitOpened:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[:DELIVERED]-> (lockerUnitDelivered:lockerUnit)\n` +
        `OPTIONAL MATCH (o) -[req:REQUIRE]-> (s:service)\n` +
        `OPTIONAL MATCH (o) <-[:BEFORE_IMAGE]- (bi:file)\n` +
        `OPTIONAL MATCH (o) <-[:AFTER_IMAGE]- (ai:file)\n` +
        `OPTIONAL MATCH (o) <-[:FOR]- (e:event)\n` +
        `RETURN o, MAX(e.time) AS time, lockerUnitOpened, lockerUnitDelivered,\n` +
        `COLLECT(DISTINCT s {\n` +
        `  id: ID(s),\n` +
        `  done: req.done,\n` +
        `  price: req.price\n` +
        `}) AS services,\n` +
        `COLLECT(DISTINCT bi) AS imagesBefore,\n` +
        `COLLECT(DISTINCT ai) AS imagesAfter`
      ).then(result =>
        resolveObject(result.records[0] as any)
      )
    } else {
      throw new Error('Missing order event')
    }
  }
}
export const calculateOrdersRequestPrice = async(
  utilities: {
    couponPersistence: CouponPersistence
  },
  request: PersistedOrdersRequest
) => {
  const {couponPersistence} = utilities
  const coupon = request.coupon
    ? await couponPersistence.getCoupon({
        code: request.coupon
      })
    : undefined
  const getOrderServiceCost = (order:PersistedLockerOrder | PersistedPhysicalOrder) =>
    order.services.reduce((price, service) =>
      price + (coupon
        ? calculateServiceProductPrice(service, coupon)
        : service.price
      ), 0
    )
  const servicePrice = request.type === 'locker'
    ? request.orders.reduce((price, order) => price + getOrderServiceCost(order), 0)
    : request.orders.reduce((price, order) => price + getOrderServiceCost(order), 0)
  const productPrice = request.type === 'physical'
    ? request.products.reduce(
        (price, product) => price + (product.quantity * (coupon
          ? calculateServiceProductPrice(product, coupon)
          : product.price
        )), 0
      )
    : 0
  return servicePrice + productPrice
}

export type ServiceOrder = {
  id: number
  price: number
  done: boolean
}
export type ProductOrder = {
  id: number
  quantity: number
  price: number
}
export type BaseOrderParameter = {
  name: string
  services: ServiceOrder[]
}
export type BaseOrderLockerOpenParameter = {
  lockerUnitOpened: number
}
export type BaseOrderDepositParameter = {}
export type BaseOrderRetrieveStoreParameter = {}
export type BaseOrderDeliverStoreParameter = {
  imagesBefore: number[]
}
export type BaseOrderCleanParameter = {
  imagesAfter: number[]
}
export type BaseOrderLockerDeliverBackParameter = {
  lockerUnitDelivered: number
}
export type BaseOrderRetrieveBackParameter = {}

type LockerOrderLockerOpenedParameter = {type:'locker'} & BaseOrderParameter & BaseOrderLockerOpenParameter
type LockerOrderDepositedParameter = LockerOrderLockerOpenedParameter & BaseOrderDepositParameter
type LockerOrderRetrievedStoreParameter = LockerOrderDepositedParameter & BaseOrderRetrieveStoreParameter
type LockerOrderDeliveredStoreParameter = LockerOrderRetrievedStoreParameter & BaseOrderDeliverStoreParameter
type LockerOrderCleanedParameter = LockerOrderDeliveredStoreParameter & BaseOrderCleanParameter
type LockerOrderDeliveredBackParameter = LockerOrderCleanedParameter & BaseOrderLockerDeliverBackParameter
type LockerOrderRetrievedParameter = LockerOrderDeliveredBackParameter & BaseOrderRetrieveBackParameter
type LockerOrderCancelledParameter = LockerOrderLockerOpenedParameter
export type LockerOrder = (
  | (LockerOrderLockerOpenedParameter & {status:'opened-locker'})
  | (LockerOrderDepositedParameter & {status:'deposited'})
  | (LockerOrderRetrievedStoreParameter & {status:'retrieved-store'})
  | (LockerOrderDeliveredStoreParameter & {status:'delivered-store'})
  | (LockerOrderCleanedParameter & {status:'cleaned'})
  | (LockerOrderDeliveredBackParameter & {status:'delivered-back'})
  | (LockerOrderRetrievedParameter & {status:'retrieved-back'})
  | (LockerOrderCancelledParameter & {status:'cancelled'})
)
export type PersistedLockerOrder = LockerOrder & {
  id: number
  time: Date
}

type PhysicalOrderDepositedParameter = {type:'physical'} & BaseOrderParameter & BaseOrderDepositParameter
type PhysicalOrderDeliveredStoreParameter = PhysicalOrderDepositedParameter & BaseOrderDeliverStoreParameter
type PhysicalOrderCleanedParameter = PhysicalOrderDeliveredStoreParameter & BaseOrderCleanParameter
type PhysicalOrderRetrievedBackParameter = PhysicalOrderCleanedParameter & BaseOrderRetrieveBackParameter
type PhysicalOrderCancelledParameter = PhysicalOrderDepositedParameter
export type PhysicalOrder = (
  | (PhysicalOrderDepositedParameter & {status:'deposited'})
  | (PhysicalOrderDeliveredStoreParameter & {status:'delivered-store'})
  | (PhysicalOrderCleanedParameter & {status:'cleaned'})
  | (PhysicalOrderRetrievedBackParameter & {status:'retrieved-back'})
  | (PhysicalOrderCancelledParameter & {status:'cancelled'})
)
export type PersistedPhysicalOrder = PhysicalOrder & {
  id: number
  time: Date
}

export type BaseOrdersRequestParameter = {
  status: 'in-progress' | 'cancelled'
  invoiceId: number
  orderer: number
  payments: Payment[]
  remark: string
  pickUpTime?: Date
  coupon?: string
}
export type OrdersRequest = BaseOrdersRequestParameter & (
  | {type:'locker', orders:[LockerOrder]}
  | {type:'physical', store:number, orders:PhysicalOrder[], products:ProductOrder[]}
)
export type PersistedOrdersRequest = {
  id: number
  time: Date
  status: 'in-progress' | 'cancelled'
  invoiceId: number
  orderer: number
  payments: PersistedPayment[]
  remark: string
  pickUpTime?: Date
  coupon?: string
} & (
  | {type:'locker', orders:[PersistedLockerOrder]}
  | {type:'physical', store:number, orders:PersistedPhysicalOrder[], products:ProductOrder[]}
)

export type PersistedOrdersRequestEvent = {
  id: number
  time: Date
  type: 'created' | 'updated'
  _requestor: number
  _payment: string
  _remark: string
  _pickUpTime?: Date
  _coupon?: string
}
export type PersistedOrderEvent = {
  id: number
  time: Date
  type: 'created' | 'updated' | 'reverted'
  _requestor: number
  _reverter?: number
  _name?: string
  _type?: string
  _status?: string
  _services?: string[]
  _lockerUnitOpened?: number
  _lockerUnitDelivered?: number
  _imagesBefore?: number[]
  _imagesAfter?: number[]
}

export default RequestPersistence