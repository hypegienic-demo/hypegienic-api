import {AddressInfo} from 'net'

import getApp from './app'
import firebaseCredentials from '../firebase.json'
import {FirebaseStore} from './persistence'
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
import Socket from './socket'

const startServer = async(port:number) => {
  FirebaseStore.initializeFirebase(firebaseCredentials)
  const socket = new Socket()
  const lockerPersistence = new LockerPersistence(NEO4J_HOST, NEO4J_USER)
  const devicePersistence = new DevicePersistence(NEO4J_HOST, NEO4J_USER)
  const notificationPersistence = new NotificationPersistence(NEO4J_HOST, NEO4J_USER)
  const utilities = {
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
    blockPersistence: new BlockPersistence(NEO4J_HOST, NEO4J_USER),
    transactionPersistence: new TransactionPersistence(NEO4J_HOST, NEO4J_USER),
    walletPersistence: new WalletPersistence(NEO4J_HOST, NEO4J_USER),
    filePersistence: new FilePersistence(NEO4J_HOST, NEO4J_USER),
    notificationPersistence,
    mailPersistence: new MailPersistence(NEO4J_HOST, NEO4J_USER),
    spacesAPI: new SpacesAPI(SPACES_URL),
    billPlzAPI: new BillPlzAPI(BILLPLZ_HOST, BILLPLZ_SECRETS),
    sendGridAPI: new SendGridAPI(SENDGRID_KEY),
    gmailAPI: new GmailAPI(firebaseCredentials)
  }
  const chatbot = new DiscordChatbot(DISCORD_TOKEN, utilities)
  const app = getApp({
    ...utilities,
    chatbot
  })

  app.listen(port)
  await Promise.all([
    chatbot.login(),
    utilities.blockPersistence.generateSnapshot(),
    new Promise((resolve, reject) => {
      app.once('listening', resolve)
      app.once('error', reject)
    })
  ])

  console.log(
    `Koa listening on port ${(app.address() as AddressInfo).port}`
  )
}
startServer(PORT ?? 8080)