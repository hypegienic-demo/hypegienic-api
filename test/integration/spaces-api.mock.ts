import {nanoid} from 'nanoid'

import SpacesAPI, {UploadedFile} from '../../src/integration/spaces-api'

const spaces:{
  bucket: string
  key: string
  file: Buffer
}[] = []
export default class MockSpacesAPI extends SpacesAPI {
  constructor() {
    super('')
  }
  uploadFile = async(fileName:string, file:Buffer) => {
    const space = {
      bucket: 'hypegienic-space',
      key: `${nanoid()}/${fileName}`,
      file
    }
    spaces.push(space)
    return space
  }
  retrieveFile = (file:UploadedFile) =>
    `${file.bucket}/${file.key}`
}