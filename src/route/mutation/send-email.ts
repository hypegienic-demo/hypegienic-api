import * as fs from 'fs'

import {getUserEmployeeRole} from '../../persistence/user'
import {Method} from '..'
import {Upload} from '../upload'

const method:Method<Request, boolean> = {
  type: 'mutation',
  title: 'sendEmail',
  request: [
    'to: String!',
    'subject: String!',
    'text: String!',
    'attachments: [Upload!]'
  ],
  response: 'Boolean',
  schema: ``,
  resolver: async(utilities, request, argument) => {
    const {
      authenticationStore,
      userPersistence,
      mailPersistence,
      filePersistence,
      gmailAPI,
      spacesAPI
    } = utilities
    const decodedToken = await authenticationStore.verifyToken(argument.authorization)
    const user = await userPersistence.getUser({
      firebaseId: decodedToken.uid
    })
    if(!user) {
      throw new Error("User haven't register yet...")
    } else if(!getUserEmployeeRole(user)) {
      throw new Error("User isn't authorized")
    }
    const toUser = await userPersistence.getUser({
      userId: parseInt(request.to)
    })
    if(!toUser) {
      throw new Error('Recipient user not found')
    }
    const attachments = request.attachments
      ? await Promise.all(
          request.attachments
            .map(async(attachment) => {
              const buffer = await new Promise<Buffer>((resolve, reject) =>
                fs.readFile(attachment.path, (error, data) => {
                  if(error) reject(error)
                  else resolve(data)
                })
              )
              return {
                filename: attachment.originalFilename,
                content: buffer
              }
            })
        )
      : []
    const files = await Promise.all(
      attachments.map(async(attachment) => {
        const file = await spacesAPI.uploadFile(attachment.filename, attachment.content)
        return filePersistence.createFile({
          type: 'spaces',
          ...file
        })
      })
    )
    await mailPersistence.createMail({
      from: user.id,
      to: toUser.id,
      subject: request.subject,
      text: request.text,
      attachments: files.map(file => file.id)
    })
    await gmailAPI.send({
      to: toUser.email,
      subject: request.subject,
      text: request.text,
      attachments
    })
    return true
  }
}
type Request = {
  to: string
  subject: string
  text: string
  attachments?: Upload[]
}

export default method