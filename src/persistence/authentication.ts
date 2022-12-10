import * as FirebaseAdmin from 'firebase-admin'

import {FirebaseStore} from './'

class AuthenticationStore extends FirebaseStore {
  verifyToken = (idToken:string, checkRevoked?:boolean) =>
    this.app.auth().verifyIdToken(idToken, checkRevoked)
  getUser = (uid:string) =>
    this.app.auth().getUser(uid)
  getUserByMobileNumber = (mobileNumber:string) =>
    this.app.auth().getUserByPhoneNumber(mobileNumber)
  getUserByEmail = (email:string) =>
    this.app.auth().getUserByEmail(email)
  updateUser = (uid:string, update:FirebaseAdmin.auth.UpdateRequest) =>
    this.app.auth().updateUser(uid, update)
}
export default AuthenticationStore