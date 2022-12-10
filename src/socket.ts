import * as io from 'socket.io'

export default class Socket {
  protected server?:io.Server
  initialListeners:[string, (socket:io.Socket) => void][] = []

  setupConnection = (server:io.Server) => {
    this.server = server
    this.initialListeners.forEach(listener =>
      this.server?.on(...listener)
    )
    this.initialListeners = []
  }
  emit = (event:string, ...args:any[]) => {
    this.server?.emit(event, ...args)
  }
  on = (event:string, listener:(socket:io.Socket) => void) => {
    if(this.server) {
      this.server.on(event, listener)
    } else {
      this.initialListeners.push([event, listener])
    }
  }
}
type SocketConnection = io.Socket
export {
  SocketConnection
}
