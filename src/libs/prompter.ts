import * as readline from 'readline';
import socketio from 'socket.io';
import { SocketConnections } from '../types';

export function prompt(io: socketio.Server, connections: SocketConnections) {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.setPrompt('> ')
    rl.on('line', function(line) {
        let cmds = line.trim().split(' ')
        switch(cmds[0].toLowerCase()) {
            case 'help':
                console.log('Available commands: help, list, info <peer id>, exit')
                break;
            case 'list':
                console.log(connections)
                break
            case 'info':
                if (!cmds[1]) {
                    console.log("Client ID required")
                    break
                }
                if (!connections[cmds[1]]) {
                    console.log(`Client ID "${cmds[1]}" doesn't exists or disconnected`)
                    break
                }
                console.log(connections[cmds[1]])
                break
            case 'exit':
                rl.close()
                break
            case 'eval':
                if (!cmds[1]) {
                    console.log(`Script must be specified`)
                    break
                }
                io.emit('eval', cmds.slice(1).join(' '))
                break
            case 'evalto': 
                if (!connections[cmds[1]]) {
                    console.log(`Client ID "${cmds[1]}" doesn't exists or disconnected`)
                    break
                }
                if (!cmds[2]) {
                    console.log(`Script must be specified`)
                    break
                }
                io.emit('eval', cmds.slice(2).join(' '))
                break
            default:
                console.log("Say what? I don't understand that");
            break;
        }
        rl.prompt();
    }).on('close', function() {
        console.log('Have a great day!');
        process.exit(0);
    });

    rl.prompt()
}