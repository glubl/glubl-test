import type { Socket } from 'socket.io';

export type SocketConnections = { 
    [peerId: string]: {
        socketId: string;
        peerId: string;
        peerType: string;
        socket: Socket;
    } 
}