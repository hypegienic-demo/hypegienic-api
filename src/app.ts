import * as http from 'http'
import * as path from 'path'
import Koa from 'koa'
import KoaRouter from 'koa-router'
import serve from 'koa-static-server'
import compress from 'koa-compress'
import cors from '@koa/cors'
import io from 'socket.io'

import AuthenticationStore from './persistence/authentication'
import UserPersistence from './persistence/user'
import LockerPersistence, {PhysicalLockerStore} from './persistence/locker'
import ServicePersistence from './persistence/service'
import ProductPersistence from './persistence/product'
import RequestPersistence from './persistence/request'
import CouponPersistence from './persistence/coupon'
import StorePersistence from './persistence/store'
import DevicePersistence from './persistence/device'
import BlockPersistence from './persistence/block'
import TransactionPersistence from './persistence/transaction'
import WalletPersistence from './persistence/wallet'
import FilePersistence from './persistence/file'
import NotificationStore, {NotificationPersistence} from './persistence/notification'
import MailPersistence from './persistence/mail'
import SpacesAPI from './integration/spaces-api'
import BillPlzAPI from './integration/billplz-api'
import SendGridAPI from './integration/sendgrid-api'
import GmailAPI from './integration/gmail-api'
import DiscordChatbot from './chatbot'
import useRouter from './router'
import Socket from './socket'
import buildRoutes from './route'

export type Utilities = {
  socket: Socket
  authenticationStore: AuthenticationStore
  notificationStore: NotificationStore
  physicalLockerStore: PhysicalLockerStore
  userPersistence: UserPersistence
  lockerPersistence: LockerPersistence
  servicePersistence: ServicePersistence
  productPersistence: ProductPersistence
  requestPersistence: RequestPersistence
  couponPersistence: CouponPersistence
  storePersistence: StorePersistence
  devicePersistence: DevicePersistence
  blockPersistence: BlockPersistence
  transactionPersistence: TransactionPersistence
  walletPersistence: WalletPersistence
  filePersistence: FilePersistence
  notificationPersistence: NotificationPersistence
  mailPersistence: MailPersistence
  spacesAPI: SpacesAPI
  billPlzAPI: BillPlzAPI
  sendGridAPI: SendGridAPI
  gmailAPI: GmailAPI
  chatbot: DiscordChatbot
}
const getApp = (utilities:Utilities) => {
  const app = new Koa()
  const router = new KoaRouter<Koa.DefaultState, KoaRouter.RouterContext & {request:{body:any}}>()

  buildRoutes(router, utilities)
  app.use(compress())
  app.use(cors())
  app.use(useRouter)
  app.use(serve({
    rootDir: path.join(__dirname, 'public'),
    rootPath: '/public'
  }))
  app.use(router.routes())

  const server = http.createServer(app.callback())
  const socketIO = new io.Server(server)
  const {socket} = utilities
  socket?.setupConnection(socketIO)

  return server
}

export default getApp