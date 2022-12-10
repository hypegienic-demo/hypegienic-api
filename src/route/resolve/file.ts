import {PersistedUser} from '../../persistence/user'
import {PersistedFile} from '../../persistence/file'
import {Utilities} from '../../app'

export const schema = `
  type File {
    id: String!
    type: String!
    url: String!
  }
`
export default async(utilities:Utilities, user:PersistedUser, file:PersistedFile) => {
  const {spacesAPI} = utilities
  return file
    ? {
        id: file.id,
        type: file.type,
        url: () => {
          switch(file.type) {
          case 'spaces':
            return spacesAPI.retrieveFile(file)
          }
        }
      }
    : undefined
}