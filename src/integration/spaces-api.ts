import AWS from 'aws-sdk'
import {nanoid} from 'nanoid'

if(SPACES_CREDENTIAL) {
  AWS.config.update({
    credentials: new AWS.Credentials(SPACES_CREDENTIAL)
  })
}
class SpacesAPI {
  private space?: AWS.S3
  constructor(url:string) {
    if(url) {
      this.space = new AWS.S3({
        endpoint: new AWS.Endpoint(url)
      })
    }
  }
  uploadFile = (fileName:string, file:Buffer) =>
    new Promise<UploadedFile>((resolve, reject) =>
      this.space?.upload({
        Bucket: 'hypegienic-space',
        Key: `${ENV}/${nanoid()}/${fileName}`,
        Body: file,
      }, (error, data) => {
        if(error) reject(error)
        else resolve({
          bucket: data.Bucket,
          key: data.Key
        })
      })
    )
  retrieveFile = (file:UploadedFile) =>
    this.space?.getSignedUrl('getObject', {
      Bucket: file.bucket,
      Key: file.key
    })
}
export type UploadedFile = {
  bucket: string
  key: string
}
export default SpacesAPI