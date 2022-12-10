export const uploadSchema = `
  input Upload {
    headers: UploadHeader
    fieldName: String!
    originalFilename: String!
    path: String!
    size: Int!
  }
  input UploadHeader {
    contentDisposition: String
    contentType: String
    name: String
    filename: String
    size: Int
  }
`

export type Upload = {
  headers: {
    contentDisposition?: string
    contentType?: string
    name?: string
    filename?: string
    size?: number
  }
  fieldName: string
  originalFilename: string
  path: string
  size: number
}