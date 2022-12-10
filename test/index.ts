import {Server} from 'http'
import neo4j from 'neo4j-driver'

import getApp from '../src/app'
import Socket from '../src/socket'
import AuthenticationStore from './persistence/authentication.mock'
import UserPersistence from './persistence/user.mock'
import LockerPersistence, {MockPhysicalLockerStore as PhysicalLockerStore} from './persistence/locker.mock'
import ServicePersistence from './persistence/service.mock'
import ProductPersistence from './persistence/product.mock'
import RequestPersistence from './persistence/request.mock'
import CouponPersistence from './persistence/coupon.mock'
import StorePersistence from './persistence/store.mock'
import DevicePersistence from './persistence/device.mock'
import BlockPersistence from './persistence/block.mock'
import TransactionPersistence from './persistence/transaction.mock'
import WalletPersistence from './persistence/wallet.mock'
import FilePersistence from './persistence/file.mock'
import NotificationStore, {MockNotificationPersistence as NotificationPersistence} from './persistence/notification.mock'
import MailPersistence from './persistence/mail.mock'
import SpacesAPI from './integration/spaces-api.mock'
import BillPlzAPI from './integration/billplz-api.mock'
import SendGridAPI from './integration/sendgrid-api.mock'
import GmailAPI from './integration/gmail-api.mock'
import DiscordChatbot from './chatbot/bot.mock'

declare const NEO4J_HOST:string
declare const NEO4J_USER:{user:string, password:string}

let chatbot:DiscordChatbot
export const runTestingApp = async():Promise<TestingApp> => {
  const socket = new Socket()
  const lockerPersistence = new LockerPersistence(NEO4J_HOST, NEO4J_USER)
  const devicePersistence = new DevicePersistence(NEO4J_HOST, NEO4J_USER)
  const notificationPersistence = new NotificationPersistence(NEO4J_HOST, NEO4J_USER)
  const blockPersistence = new BlockPersistence(NEO4J_HOST, NEO4J_USER)
  const chatbotUtilities = {
    socket,
    authenticationStore: new AuthenticationStore(),
    notificationStore: new NotificationStore({
      devicePersistence,
      notificationPersistence
    }),
    physicalLockerStore: new PhysicalLockerStore({
      socket,
      lockerPersistence
    }),
    userPersistence: new UserPersistence(NEO4J_HOST, NEO4J_USER),
    lockerPersistence,
    servicePersistence: new ServicePersistence(NEO4J_HOST, NEO4J_USER),
    productPersistence: new ProductPersistence(NEO4J_HOST, NEO4J_USER),
    requestPersistence: new RequestPersistence(NEO4J_HOST, NEO4J_USER),
    couponPersistence: new CouponPersistence(NEO4J_HOST, NEO4J_USER),
    storePersistence: new StorePersistence(NEO4J_HOST, NEO4J_USER),
    devicePersistence,
    blockPersistence,
    transactionPersistence: new TransactionPersistence(NEO4J_HOST, NEO4J_USER),
    walletPersistence: new WalletPersistence(NEO4J_HOST, NEO4J_USER),
    filePersistence: new FilePersistence(NEO4J_HOST, NEO4J_USER),
    notificationPersistence,
    mailPersistence: new MailPersistence(NEO4J_HOST, NEO4J_USER),
    spacesAPI: new SpacesAPI(),
    billPlzAPI: new BillPlzAPI(),
    sendGridAPI: new SendGridAPI(),
    gmailAPI: new GmailAPI()
  }
  chatbot = new DiscordChatbot(chatbotUtilities)
  const utilities = {
    ...chatbotUtilities,
    chatbot
  }
  const neo4jDriver = neo4j.driver(NEO4J_HOST, neo4j.auth.basic(NEO4J_USER.user, NEO4J_USER.password))
  const neo4jSession = neo4jDriver.session()
  await neo4jSession.run(`MATCH (n) DETACH DELETE n`)
  for(const persistence of [
    utilities.storePersistence,
    utilities.lockerPersistence,
    utilities.productPersistence,
    utilities.servicePersistence,
    utilities.userPersistence,
    utilities.devicePersistence,
    utilities.filePersistence,
    utilities.requestPersistence,
    utilities.couponPersistence,
    utilities.walletPersistence,
    utilities.transactionPersistence,
    utilities.blockPersistence,
    utilities.notificationPersistence,
    utilities.mailPersistence
  ]) {
    await persistence.initializeData(neo4jSession)
  }
  await neo4jSession.close()
  await neo4jDriver.close()
  const app = getApp(utilities)
  const server = app.listen()
  await Promise.all([
    blockPersistence.generateSnapshot(),
    new Promise((resolve, reject) => {
      app.once('listening', resolve)
      app.once('error', reject)
    })
  ])
  return {
    server,
    utilities
  }
}
export const destroyTestingApp = async(app:TestingApp) => {
  await new Promise<void>((resolve, reject) =>
    app.server.close(error => {
      if(error) reject(error)
      else resolve()
    })
  )
  app.utilities.chatbot?.destroy()
}
export type TestingApp = {
  server: Server
  utilities: {
    socket: Socket
    authenticationStore: AuthenticationStore
    notificationStore: NotificationStore
    physicalLockerStore: PhysicalLockerStore
    userPersistence: UserPersistence
    lockerPersistence: LockerPersistence
    servicePersistence: ServicePersistence
    requestPersistence: RequestPersistence
    devicePersistence: DevicePersistence
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
}