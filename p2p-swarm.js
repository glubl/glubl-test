// IMPORRTS
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const sirv = require("sirv")

// ENVIRONMENT VARIABLES
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || "3030");
const TOKEN = process.env.TOKEN || "token";
const DEV = process.env.NODE_ENV === "development";
const PEER_NUM = parseInt(process.env.PEER_NUM || "4");
const CONN_EXP = parseInt(process.env.CONN_EXP || "1");

/**
 * @param {string[]} peers 
 * @param {number} exp 
 * @returns {{[key: string]: Set<string>}}
 */
function combine(peers, exp) {
    /** @type {{[key: string]: Set<string>}} */
    const result = {}
    peers.forEach((p, i) => {
        for (var ii = 1; ii <= Math.min(exp, peers.length); ii++) {
            const q = peers[(i + ii) % peers.length]
            if (q === p) continue
                ; (result[p] ??= new Set()).add(q)
                ; (result[q] ??= new Set()).add(p)
        }
    })
    return result
}

// SETUP SERVERS
const app = express();
app.use(express.json(), cors());
const server = http.createServer(app);
const io = socketio(server, { cors: {} });

// AUTHENTICATION MIDDLEWARE
io.use((socket, next) => {
    const token = socket.handshake.auth.token; // check the auth token provided by the client upon connection
    if (token === TOKEN) {
        next();
    } else {
        next(new Error("Authentication error"));
    }
});

// API ENDPOINT TO DISPLAY THE CONNECTION TO THE SIGNALING SERVER
/**
 * @type {{ 
 *     [peerId: string]: {
 *         socketId: string;
 *         peerId: string;
 *         peerType: string;
 *     } 
 * }}
 */
let connections = {};
app.get("/connections", (req, res) => {
    res.json(Object.values(connections));
});

function pairRtc() {
    console.log("Sending rtc pairs")
    let peerIds = Object.keys(connections)
    const pairs = combine(peerIds, CONN_EXP)
    Object.entries(pairs)
        .forEach(([id, peers]) => {
            io.to(connections[id].socketId).emit("initRTC", Array.from(peers))
        })
}

io.on("connection", (socket) => {
    let pid = ""
    console.log("User connected with id", socket.id);
    socket.on("ready", (peerId, peerType) => {
        if (peerId in connections) {
            socket.emit("uniquenessError", {
                message: `${peerId} is already connected to the signalling server. Please change your peer ID and try again.`,
            });
            socket.disconnect(true);
        } else {
            console.log(`Added ${peerId} to connections`);
            connections[peerId] = { socketId: socket.id, peerId, peerType };
            pid = peerId
            if (Object.keys(connections).length >= PEER_NUM)
                pairRtc()
        }
    });
    socket.on("message", (message) => {
        socket.broadcast.emit("message", message);
    });
    socket.on("messageOne", async (message) => {
        const { target } = message;
        const targetPeer = connections[target];
        if (targetPeer) {
            io.to(targetPeer.socketId).emit("message", { ...message, from: pid });
        } else {
            socket.emit("messageError", `Peer ID ${target} not found`)
        }
    });
    socket.on("disconnect", () => {
        const disconnectingPeer = Object.values(connections).find((peer) => peer.socketId === socket.id);
        if (disconnectingPeer) {
            console.log("Disconnected", socket.id, "with peerId", disconnectingPeer.peerId);
            delete connections[disconnectingPeer.peerId];
        } else {
            console.log(socket.id, "has disconnected");
        }
        if (Object.keys(connections).length >= PEER_NUM)
            pairRtc()
    });


});

app.use(sirv("public", { DEV }));
server.listen(PORT, HOST, undefined, () => console.log(`Listening on ${HOST}:${PORT}`));