import Koa from 'koa'
import KoaRouter from 'koa-router'
import {graphql, buildSchema} from 'graphql'

import {Utilities} from '../app'
import {uploadSchema} from './upload'
import {schema as fileSchema} from './resolve/file'
import {schema as userSchema} from './resolve/user'
import {schema as lockerSchema} from './resolve/locker'
import {schema as serviceSchema} from './resolve/service'
import {schema as productSchema} from './resolve/product'
import {schema as requestSchema} from './resolve/request'
import {schema as storeSchema} from './resolve/store'
import signIn from './query/sign-in'
import displayProfile from './query/display-profile'
import registerMobile from './mutation/register-mobile'
import updateProfile from './mutation/update-profile'
import addDevice from './mutation/add-device'
import removeDevice from './mutation/remove-device'
import requestTopUp from './mutation/request-top-up'
import displayLockers from './query/display-lockers'
import displayStores from './query/display-stores'
import displayServices from './query/display-services'
import displayProducts from './query/display-products'
import previewDiscountedServices from './query/preview-discounted-services'
import requestLocker from './mutation/request-locker'
import confirmDeposit from './mutation/confirm-deposit'
import cancelLocker from './mutation/cancel-locker'
import displayRequests from './query/display-requests'
import updateOrderServices from './mutation/update-order-services'
import updateRequestProducts from './mutation/update-request-products'
import requestRetrieveBack from './mutation/request-retrieve-back'
import confirmRetrieve from './mutation/confirm-retrieve'
import undoOrder from './mutation/undo-order'
import addUser from './mutation/add-user'
import displayUsers from './query/display-users'
import addRequest from './mutation/add-request'
import requestRetrieveStore from './mutation/request-retrieve-store'
import addBeforeImages from './mutation/add-before-images'
import updateServiceStatus from './mutation/update-service-status'
import addAfterImages from './mutation/add-after-images'
import deliverBackLocker from './mutation/deliver-back-locker'
import confirmCloseLocker from './mutation/confirm-close-locker'
import addRequestCoupon from './mutation/add-request-coupon'
import addRequestPayment from './mutation/add-request-payment'
import addRequestPickUpTime from './mutation/add-request-pickup-time'
import updateRequestRemark from './mutation/update-request-remark'
import cancelRequest from './mutation/cancel-request'
import addTransaction from './mutation/add-transaction'
import markReadNotifications from './mutation/mark-read-notifications'
import sendEmail from './mutation/send-email'
import billPlzResultCallback from './callback/billplz-result'
import sendGridMailCallback from './callback/sendgrid-mail'

export type Methods = {
  path: string
  schemas: string[]
  roots: Method<any, any>[]
}
export type Method<Request extends Record<string, any>, Response> = {
  type: 'query' | 'mutation'
  title: string
  request: string[]
  response: string
  schema: string
  resolver: (
    utilities: Utilities,
    request: Request,
    argument: {authorization:string, userAgent:string}
  ) =>
    PromiseLike<Response> | Response
}
export type Route<Request extends Record<string, any>, Response> = {
  type: 'get'
  path: string
  resolver: (
    utilities: Utilities
  ) =>
    PromiseLike<Response> | Response
} | {
  type: 'post'
  path: string
  resolver: (
    utilities: Utilities,
    request: Request
  ) =>
    PromiseLike<Response> | Response
}
export const graphMethods:Methods = {
  path: '/root',
  schemas: [
    fileSchema,
    userSchema,
    lockerSchema,
    serviceSchema,
    productSchema,
    requestSchema,
    storeSchema
  ],
  roots: [
    signIn,
    displayProfile,
    registerMobile,
    updateProfile,
    addDevice,
    removeDevice,
    requestTopUp,
    displayLockers,
    displayStores,
    displayServices,
    displayProducts,
    previewDiscountedServices,
    requestLocker,
    confirmDeposit,
    cancelLocker,
    displayRequests,
    updateOrderServices,
    updateRequestProducts,
    requestRetrieveBack,
    confirmRetrieve,
    undoOrder,
    markReadNotifications,
    addUser,
    displayUsers,
    addRequest,
    requestRetrieveStore,
    addBeforeImages,
    updateServiceStatus,
    addAfterImages,
    deliverBackLocker,
    confirmCloseLocker,
    addRequestCoupon,
    addRequestPayment,
    addRequestPickUpTime,
    updateRequestRemark,
    cancelRequest,
    addTransaction,
    sendEmail
  ]
}
export const routes:Route<any, any>[] = [
  billPlzResultCallback,
  sendGridMailCallback
]
type RouteDetail = {paths:string[], utilities:Utilities, authorization?:string}
const reportError = async(error:Error,
  {paths, utilities, authorization}: RouteDetail
) => {
  const decodedToken = await (async() => {
    try {
      return authorization
        ? await utilities.authenticationStore.verifyToken(authorization)
        : undefined
    } catch {
      return undefined
    }
  })()
  await utilities.chatbot.sendMessage('error', {
    embed: {
      title: 'Error',
      description: paths.map(path =>
          `\`${path}\`\n`
        ) +
        error.message,
      author: decodedToken
        ? {name:decodedToken.phone_number}
        : undefined
    }
  })
}
const convertBody = (body:any, detail:RouteDetail):any => {
  if (body === undefined || body === null) {
    return undefined
  } else if (body instanceof Error) {
    if(ENV === 'production') {
      reportError(body, detail)
    }
    console.error(body)
    return body.message
  } else if (Array.isArray(body)) {
    return body.map(item =>
      convertBody(item, detail)
    )
  } else if (typeof body === 'object') {
    return Object.keys(body).reduce(
      (converted, key) => ({
        ...converted,
        [key]: convertBody(body[key], detail),
      }),
      {}
    )
  } else {
    return body
  }
}
export default (router:KoaRouter<Koa.DefaultState, KoaRouter.RouterContext & {request:{body:any}}>, utilities:Utilities) => {
  router.post(graphMethods.path, async(context, next) => {
    const argument = {
      authorization: context.request.header['authorization'],
      userAgent: context.request.header['user-agent'],
    }
    const schema = buildSchema(`
      ${uploadSchema}
      ${graphMethods.schemas.join('\n')}
      ${graphMethods.roots.map(root =>
        root.schema
      ).join('\n')}
      
      ${graphMethods.roots.some(root => root.type === 'query')
        ? `type Query {
            ${graphMethods.roots
              .filter(root => root.type === 'query')
              .map(root =>
                `${root.title}${root.request.length > 0? `(${root.request.join(', ')})`:''}: ${root.response}`
              )
            }
          }`
        : ''
      }
      ${graphMethods.roots.some(root => root.type === 'mutation')
        ? `type Mutation {
            ${graphMethods.roots
              .filter(root => root.type === 'mutation')
              .map(root =>
                `${root.title}${root.request.length > 0? `(${root.request.join(', ')})`:''}: ${root.response}`
              )
            }
          }`
        : ''
      }
    `)
    if(context.request.body) {
      let paths:string[] = []
      const body = await graphql(
        schema,
        context.request.body['graphql'],
        graphMethods.roots.reduce(
          (roots, root) => ({
            ...roots,
            [root.title]: (...requests:[Record<string, any>, {authorization:string, userAgent:string}]) => {
              console.log(`Incoming: /root:${root.title}`)
              paths.push(`/root:${root.title}`)
              return root.resolver(utilities, ...requests)
            }
          }),
          {} as Record<
            string,
            (request:Record<string, any>, argument:{authorization:string, userAgent:string}) => Promise<any>
          >
        ),
        argument,
        context.request.body['files']
      )
      context.body = convertBody(body, {
        paths,
        utilities,
        authorization: argument.authorization
      })
    }
    next()
  })
  routes.forEach(route =>
    route.type === 'get'
      ? router.get(route.path, async(context, next) => {
          console.log(`Incoming: ${route.path}`)
          if(context.request.body) {
            const body = await route.resolver(utilities)
            context.body = convertBody(body, {
              paths: [route.path],
              utilities
            })
          }
          next()
        })
      : router.post(route.path, async(context, next) => {
          console.log(`Incoming: ${route.path}`)
          if(context.request.body) {
            const body = await route.resolver(utilities, context.request.body)
            context.body = convertBody(body, {
              paths: [route.path],
              utilities
            })
          }
          next()
        })
  )
}