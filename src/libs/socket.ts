import { Socket, io as clientIo } from "socket.io-client";
import { HOST, PORT, TOKEN } from "../libs/config"
import http from "http"
import socketio from "socket.io"
import { SocketConnections } from "../types";

// Taken from https://github.com/aljanabim/simple_webrtc_signaling_server/tree/main/examples
export class SocketClient {
    peerId: string
    socket: Socket
    onMessage: (...args: any[]) => void
    onEval: (...args: any[]) => void
    constructor(
        peerId: string, 
        signalingServerUrl: string, 
        token: string, 
        onMessage: (...args: any[]) => void,
        onEval: (...args: any[]) => void
    ) {
        this.peerId = peerId;
        this.socket = clientIo(signalingServerUrl, {
            auth: { token },
            autoConnect: false, // disables auto connection, by default the client would connect to the server as soon as the io() object is instatiated
            reconnection: true, // disables auto reconnection, this can occur when for example the host server disconnects. When set to true, the client would keep trying to reconnect
            // for a complete list of the available options, see https://socket.io/docs/v4/client-api/#new-Manager-url-options
        });
        this.onMessage = onMessage
        this.onEval = onEval
    }
    connect() {
        this.socket.on("connect", () => {
            console.log("Connected with id", this.socket.id);
            this.socket.emit("ready", this.peerId);
        });
        this.socket.on("disconnect", () => {
            console.log("Disconnected");
        });
        this.socket.on("connect_error", (error) => {
            console.log("Connection error", error.message);
        });
        this.socket.on("message", this.onMessage);
        this.socket.on("uniquenessError", (message) => {
            console.error(`Error: ${message.error}`);
            // process.exit(1);
        });
        this.socket.on("eval", this.onEval)
        this.socket.connect();
    }
    send(message: any) {
        this.socket.emit("message", { from: this.peerId, target: "all", message });
    }
    sendTo(targetPeerId: string, message: any) {
        this.socket.emit("messageOne", { from: this.peerId, target: targetPeerId, message });
    }
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

export class SocketServer {
    server: http.Server
    io: socketio.Server
    connections: SocketConnections = {}
    constructor(server: http.Server, token: string) {
        this.server = server
        this.io = new socketio.Server(this.server, { cors: {} });
        // AUTHENTICATION MIDDLEWARE
        this.io.use((socket, next) => {
            const tok = socket.handshake.auth.token; // check the auth token provided by the client upon connection
            if (tok === token) {
                next();
            } else {
                next(new Error("Authentication error"));
            }
        });

        // MESSAGING LOGIC
        this.io.on("connection", (socket) => {
            console.log("User connected with id", socket.id);

            var sockconn: SocketConnections[keyof SocketConnections]

            socket.on("ready", (peerId: string, peerType: string) => {
                // Make sure that the hostname is unique, if the hostname is already in connections, send an error and disconnect
                if (peerId in this.connections) {
                    socket.emit("uniquenessError", {
                        message: `${peerId} is already connected to the signalling server. Please change your peer ID and try again.`,
                    });
                    socket.disconnect(true);
                } else {
                    console.log(`Added ${peerId} to connections`);
                    // Let new peer know about all exisiting peers
                    socket.send(
                        { 
                            from: "all", 
                            target: peerId, 
                            payload: { 
                                action: "open", 
                                connections: Object.values(this.connections).map(({socketId, peerId, peerType}) => { return {socketId, peerId, peerType}}), 
                                bePolite: false 
                            } 
                        }
                    ); // The new peer doesn't need to be polite.
                    // Create new peer
                    const newPeer = { 
                        socketId: socket.id, 
                        peerId, 
                        peerType,
                        socket
                    };
                    // Updates connections object
                    this.connections[peerId] = newPeer;
                    sockconn = newPeer
                    // Let all other peers know about new peer
                    socket.broadcast.emit("message", {
                        from: peerId,
                        target: "all",
                        payload: { action: "open", connections: [{
                            socketId: socket.id,
                            peerId,
                            peerType
                        }], bePolite: true }, // send connections object with an array containing the only new peer and make all exisiting peers polite.
                    });
                }
            });
            socket.on("message", (message) => {
                // Send message to all peers except the sender
                socket.broadcast.emit("message", message);
            });
            socket.on("messageOne", (message) => {
                // Send message to a specific targeted peer
                const { target } = message;
                const targetPeer = this.connections[target];
                if (targetPeer) {
                    this.io.to(targetPeer.socketId).emit("message", { ...message });
                } else {
                    console.log(`Target ${target} not found`);
                }
            });
            socket.on("messageServer", (message) => {
                console.log(`${sockconn.peerId}: `, message)
            })
            socket.on("disconnect", () => {
                const disconnectingPeer = Object.values(this.connections).find((peer) => peer.socketId === socket.id);
                if (disconnectingPeer) {
                    console.log("Disconnected", socket.id, "with peerId", disconnectingPeer.peerId);
                    // Make all peers close their peer channels
                    socket.broadcast.emit("message", {
                        from: disconnectingPeer.peerId,
                        target: "all",
                        payload: { action: "close", message: "Peer has left the signaling server" },
                    });
                    // remove disconnecting peer from connections
                    delete this.connections[disconnectingPeer.peerId];
                } else {
                    console.log(socket.id, "has disconnected");
                }
            });
        });
    }
}