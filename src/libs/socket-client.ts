import { Socket, io } from "socket.io-client";

// Taken from https://github.com/aljanabim/simple_webrtc_signaling_server/tree/main/examples
export class SocketClient {
    peerId: string
    socket: Socket
    onMessage: (...args: any[]) => void
    constructor(peerId: string, signalingServerUrl: string, token: string, onMessage: (...args: any[]) => void) {
        this.peerId = peerId;
        this.socket = io(signalingServerUrl, {
            auth: { token },
            autoConnect: false, // disables auto connection, by default the client would connect to the server as soon as the io() object is instatiated
            reconnection: true, // disables auto reconnection, this can occur when for example the host server disconnects. When set to true, the client would keep trying to reconnect
            // for a complete list of the available options, see https://socket.io/docs/v4/client-api/#new-Manager-url-options
        });
        this.onMessage = onMessage
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
