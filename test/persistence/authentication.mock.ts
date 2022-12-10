import * as FirebaseAdmin from 'firebase-admin'

import AuthenticationStore from '../../src/persistence/authentication'

const users = [{
  uid: 'chingyawhao',
  email: 'chingyawhao14@gmail.com',
  emailVerified: false,
  displayName: 'Hao',
  phoneNumber: '+60129126858',
  disabled: false,
  providerData: []
}, {
  uid: 'chingyawjin',
  email: 'chingyawjin@gmail.com',
  emailVerified: false,
  displayName: 'Jin',
  phoneNumber: '+60124295578',
  disabled: false,
  providerData: []
}, {
  uid: 'limsimyee',
  email: 'simyeelim@outlook.com',
  emailVerified: false,
  displayName: 'Sim',
  phoneNumber: '+601110762614',
  disabled: false,
  providerData: []
}, {
  uid: 'not-exist',
  email: 'notexist@example.com',
  emailVerified: false,
  displayName: 'Nope',
  phoneNumber: '+60123456789',
  disabled: false,
  providerData: []
}]
export default class MockAuthenticationStore extends AuthenticationStore {
  verifyToken = async(idToken:string, checkRevoked?:boolean) => {
    const user = users.find(user => idToken === user.uid)
    if(user) {
      return {
        aud: 'hypegienic',
        auth_time: Date.now() / 1000,
        email: user.email,
        email_verified: user.emailVerified,
        exp: Date.now() / 1000 + 30 * 60,
        firebase: {
          identities: {},
          sign_in_provider: 'password',
          sign_in_second_factor: 'phone',
        },
        iat: Date.now() / 1000,
        iss: 'https://securetoken.google.com/hypegienic',
        phone_number: user.phoneNumber,
        sub: user.uid,
        uid: user.uid
      }
    } else {
      throw new Error(
        'Decoding Firebase ID token failed. ' +
        'Make sure you passed the entire string JWT which represents an ID token. ' +
        'See https://firebase.google.com/docs/auth/admin/verify-id-tokens for details on how to retrieve an ID token.'
      )
    }
  }
  getUser = async(uid:string) => {
    const user = users.find(user => uid === user.uid)
    const metadata = {
      lastSignInTime: new Date(Date.now()).toISOString(),
      creationTime: new Date(Date.now()).toISOString(),
    }
    if(user) {
      return {
        ...user,
        metadata: {
          ...metadata,
          toJSON: () => metadata
        },
        toJSON: () => ({
          ...user,
          metadata
        })
      }
    } else {
      throw new Error(
        'There is no user record corresponding to the provided identifier.'
      )
    }
  }
  getUserByMobileNumber = async(mobileNumber:string) => {
    const user = users.find(user => mobileNumber === user.phoneNumber)
    const metadata = {
      lastSignInTime: new Date(Date.now()).toISOString(),
      creationTime: new Date(Date.now()).toISOString(),
    }
    if(user) {
      return {
        ...user,
        metadata: {
          ...metadata,
          toJSON: () => metadata
        },
        toJSON: () => ({
          ...user,
          metadata
        })
      }
    } else {
      throw new Error(
        'There is no user record corresponding to the provided identifier.'
      )
    }
  }
  getUserByEmail = async(email:string) => {
    const user = users.find(user => email === user.email)
    const metadata = {
      lastSignInTime: new Date(Date.now()).toISOString(),
      creationTime: new Date(Date.now()).toISOString(),
    }
    if(user) {
      return {
        ...user,
        metadata: {
          ...metadata,
          toJSON: () => metadata
        },
        toJSON: () => ({
          ...user,
          metadata
        })
      }
    } else {
      throw new Error(
        'There is no user record corresponding to the provided identifier.'
      )
    }
  }
  updateUser = async(uid:string, update:FirebaseAdmin.auth.UpdateRequest) => {
    const user = users.find(user => uid === user.uid)
    const metadata = {
      lastSignInTime: new Date(Date.now()).toISOString(),
      creationTime: new Date(Date.now()).toISOString(),
    }
    if(user) {
      (Object.keys(update) as (keyof typeof update)[]).forEach(key =>
        (user as any)[key] = update[key]
      )
      return {
        ...user,
        metadata: {
          ...metadata,
          toJSON: () => metadata
        },
        toJSON: () => ({
          ...user,
          metadata
        })
      }
    } else {
      throw new Error(
        'There is no user record corresponding to the provided identifier.'
      )
    }
  }
}