import { HOST, PORT, TOKEN } from "./libs/config"
import http from "http"
import { SocketConnections } from "./types";
import { SocketServer } from "./libs/socket";
import { ISEA } from 'gun/types/sea';
import readline from "readline"

var { testLatencyServer } = require("./tests")
var SEA: ISEA
var server: SocketServer
var rl: readline.Interface
export async function initServer() {
    console.log("Setting up server")
    SEA = require("gun/sea") 
   
    const httpServer = http.createServer();
    server = new SocketServer(httpServer, TOKEN)

    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('line', onPrompt)
      .on('close', onClose)
      .setPrompt('> ')

    
    return new Promise<void>((res, rej) => {
        httpServer.listen(PORT, HOST, undefined, () => {
            console.log(`Listening on PORT ${PORT}`)
            rl.prompt()
            res()
        });
    })
}

const onPrompt = async (line: string) => {
    let cmds = line.trim().split(' ')
    switch(cmds[0].toLowerCase()) {
        case 'help':
            console.log('Available commands: help, list, info <peer id>, exit')
            break;
        case 'list':
            console.log(server.connections)
            break
        case 'info':
            if (!cmds[1]) {
                console.log("Client ID required")
                break
            }
            if (!server.connections[cmds[1]]) {
                console.log(`Client ID "${cmds[1]}" doesn't exists or disconnected`)
                break
            }
            console.log(server.connections[cmds[1]])
            break
        case 'exit':
            rl.close()
            break
        case 'eval':
            if (!cmds[1]) {
                console.log(`Script must be specified`)
                break
            }
            server.io.emit('eval', cmds.slice(1).join(' '))
            break
        case 'evalto': 
            let con: SocketConnections[keyof SocketConnections]
            if (!(con = server.connections[cmds[1]])) {
                console.log(`Client ID "${cmds[1]}" doesn't exists or disconnected`)
                break
            }
            if (!cmds[2]) {
                console.log(`Script must be specified`)
                break
            }
            server.io.to(con.socketId).emit('eval', cmds.slice(2).join(' '))
            break
        case 'evalhere':
            if (!cmds[1]) {
                console.log(`Script must be specified`)
                break
            }
            try {
                console.log(await eval(cmds.slice(1).join(' ')))
            } catch (error) {
                console.log(error)
            }
            break
        case 'testlatency1':
            if (Object.keys(server.connections).length < 2) {
                console.log(`There must be at least 2 connections`)
                break
            }
            var times: number | undefined
            if (cmds[1]) {
                try {
                    times = parseInt(cmds[1])
                } catch (error) {}
            }
            await testLatencyServer(
                SEA, 
                server.io, 
                server.connections, 
                'ONE',
                times, 
                typeof cmds[2] === "undefined",
                cmds[2]
            )
            break
        case 'testlatency2':
            if (Object.keys(server.connections).length < 2) {
                console.log(`There must be at least 2 connections`)
                break
            }
            var times: number | undefined
            if (cmds[1]) {
                try {
                    times = parseInt(cmds[1])
                } catch (error) {}
            }
            await testLatencyServer(
                SEA, 
                server.io, 
                server.connections, 
                'ALL',
                times
            )
            break
        case 'testlatency3':
            if (Object.keys(server.connections).length < 2) {
                console.log(`There must be at least 2 connections`)
                break
            }
            var times: number | undefined
            if (cmds[1]) {
                try {
                    times = parseInt(cmds[1])
                } catch (error) {}
            }
            await testLatencyServer(
                SEA, 
                server.io, 
                server.connections, 
                'ALL_TIMEOUT',
                times
            )
            break
        default:
            console.log("Say what? I don't understand that");
        break;
    }
    rl.prompt();
}

function onClose() {
    console.log('Have a great day!');
    process.exit(0);
}