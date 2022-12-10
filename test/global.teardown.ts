import * as process from 'child_process'
import * as fs from 'fs'

const teardown = async() => {
  const executeCommand = (command:string) =>
    new Promise<void>((resolve, reject) =>
      process.exec(command, error => {
        if(error) reject(error)
        else resolve()
      })
    )
  await executeCommand('neo4j stop')
  await executeCommand('neo4j-admin load --from=database.dump --database=graph.db --force')
  await Promise.all([
    executeCommand('neo4j start'),
    new Promise<void>((resolve, reject) =>
      fs.unlink('database.dump', error => {
        if(error) reject(error)
        else resolve()
      })
    )
  ])
}
export default teardown
