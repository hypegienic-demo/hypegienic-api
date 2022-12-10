import Koa from 'koa'
import * as querystring from 'querystring'
import getRawBody from 'raw-body'
import * as multiparty from 'multiparty'

import {routes, graphMethods} from './route'

type Upload = {
  headers: {
    contentDisposition: string
    contentType: string
    name: string
    filename: string
    size: number
  }
  fieldName: string
  originalFilename: string
  path: string
  size: number
}
const convertFile = (files:Record<string, any[]>): Record<string, Upload[]> => {
  return Object.keys(files).reduce(
    (transformed, key) => ({
      ...transformed,
      [key]: files[key]?.map(file => ({
        headers: {
          contentDisposition: file?.headers?.['content-disposition'],
          contentType: file?.headers?.['content-type'],
          name: file?.headers?.['name'],
          filename: file?.headers?.['filename'],
          size: file?.headers?.['size'],
        },
        fieldName: file?.['fieldName'],
        originalFilename: file?.['originalFilename'],
        path: file?.['path'],
        size: file?.['size'],
      })),
    }),
    {}
  )
}

const useRouter:Koa.Middleware<{}, {request:{body:any}}> = (context, next) =>
  new Promise<void>(async resolve => {
    const handleError = () => {
      context.status = 400
      context.body = 'Bad Request'
      resolve()
    }
    if(context.request.url === '/') {
      context.status = 200
      context.body = 'API running...'
      resolve()
    } else if(/\/public\/(.+)\.(svg|png)$/.test(context.request.url)) {
      await next()
      resolve()
    } else if(routes.map(route => route.path).includes(context.request.url)) {
      try {
        if('content-type' in context.header) {
          if(context.header['content-type'] === 'application/json') {
            const string = await getRawBody(context.req, 'utf-8')
            context.request.body = JSON.parse(string)
          } else if(context.header['content-type'] === 'application/x-www-form-urlencoded') {
            const string = await getRawBody(context.req, 'utf-8')
            context.request.body = querystring.parse(string)
          } else if(context.header['content-type']?.startsWith('multipart/form-data')) {
            context.request.body = await new Promise<any>((resolve, reject) => {
              const form = new multiparty.Form()
              form.parse(context.req, async(error, fields, files) => {
                if (error) {
                  reject(error)
                } else {
                  resolve({
                    ...fields,
                    ...convertFile(files)
                  })
                }
              })
            })
          }
        }
        await next()
        resolve()
      } catch (error) {
        console.error(error)
        handleError()
      }
    } else if(
      graphMethods.path === context.request.url &&
      'content-type' in context.header &&
      context.header['content-type']?.startsWith('multipart/')
    ) {
      try {
        context.request.body = await new Promise<any>((resolve, reject) => {
          const form = new multiparty.Form()
          form.parse(context.req, async(error, fields, files) => {
            if (
              error ||
              (fields.graphql?.length ?? 0) !== 1 ||
              typeof fields.graphql[0] !== 'string'
            ) {
              reject(error)
            } else {
              resolve({
                graphql: fields.graphql[0],
                files: convertFile(files),
              })
            }
          })
        })
        await next()
        resolve()
      } catch (error) {
        console.error(error)
        handleError()
      }
    } else {
      handleError()
    }
  })
export default useRouter