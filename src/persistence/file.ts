import {Persistence, stringify, resolveObject} from './'

class FilePersistence extends Persistence {
  createFile = (file:File):Promise<PersistedFile> => {
    return this.execute(
      `CREATE (f:file {\n` +
      (Object.keys(file) as (keyof typeof file)[]).map(key =>
        `  ${key}: ${stringify(file[key])}`
      ).join(',\n') + '\n' +
      `})\n` +
      `CREATE (e:event {\n` +
      `  type: "created",\n` +
      `  time: datetime(),\n` +
      (Object.keys(file) as (keyof typeof file)[])
        .filter(key => file[key] !== undefined)
        .map(key =>
          `  _${key}: ${stringify(file[key])}`
        ).join(',\n') + '\n' +
      `})\n` +
      `CREATE (e) -[:FOR]-> (f)\n` +
      `RETURN f`
    ).then(result =>
      resolveObject(result.records[0] as any)
    )
  }
  getFiles = (where: {
    fileIds?: number[]
  }):Promise<PersistedFile[]> => {
    let query:string = ''
    if(where.fileIds !== undefined) query += `WHERE ID(f) IN [${where.fileIds.join(', ')}]\n`

    if(query.length > 0) {
      return this.execute(
        `MATCH (f:file)\n` +
        query +
        `RETURN f`
      ).then(result =>
        result.records.map(resolveObject)
      )
    } else {
      throw new Error('Missing file query parameter')
    }
  }
}
export type File = {
  type: 'spaces'
  bucket: string
  key: string
}
export type PersistedFile = File & {
  id: number
}
export default FilePersistence