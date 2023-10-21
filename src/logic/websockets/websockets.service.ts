import { Injectable } from "@nestjs/common"
import { IdentityService } from "logic/identity/identity.service"
import { Socket, io } from "socket.io-client"

@Injectable()
export class WebsocketsService
{
    private sockets: { [key: string]: Socket } = {}
    private timeout = 100

    constructor(
        private readonly identityService: IdentityService
    )
    {
        const config = this.identityService.config
        
        this.timeout = config.socket_timeout
    }

    connect(url: string) : Socket
    {
        const socket = io(url)

        this.sockets[url] = socket

        return socket
    }

    listen(url: string, type: string, callback: (message: string) => void)
    {
        const socket = this.sockets[url]
        if (socket){
            socket.on(type, callback)
        }
    }

    async sendMessage(url: string, type: string, message: string) : Promise<any>
    {
        const socket = this.sockets[url]
        if (socket){
            return await socket.timeout(this.timeout).emitWithAck(type, message)
        }
    }
}