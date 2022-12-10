import * as process from 'child_process'
import * as net from 'net'

const setup = async() => {
  const executeCommand = (command:string) =>
    new Promise<void>((resolve, reject) =>
      process.exec(command, error => {
        if(error) reject(error)
        else resolve()
      })
    )
  await executeCommand('neo4j stop')
  await executeCommand('neo4j-admin dump --database=graph.db --to=database.dump')
  await executeCommand('neo4j start')
  let neo4jReady = false
  do {
    const client = new net.Socket()
    neo4jReady = await new Promise<boolean>((resolve, reject) => {
      client.once('connect', () => resolve(true))
      client.once('error', error => {
        if(error.message.includes('ECONNREFUSED')) resolve(false)
        else reject(error)
      })
      client.connect({
        host: 'localhost',
        port: 7474
      })
    })
    client.destroy()
  } while(!neo4jReady)
}
export default setup
