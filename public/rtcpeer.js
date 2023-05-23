
const ee = import("./events.js").then(({ EventEmitter }) => {
    class RTCPeer extends EventEmitter {
        pc;
        id;
        myId;
        wait;
        retry;
        lastTry = 0;
        leave = false;
        defer = 0;
        lastTried = +/* @__PURE__ */ new Date();
        waitInc;
        maxRetry;
        maxWait;
        minWait;
        pendingICECandidate = [];
        RTCPeerConnection;
        RTCSessionDescription;
        RTCIceCandidate;
        initPeerConnection;
        initDataChannel;
        initOffer;
        mediaStreams = {};
        tracksRtpSenders = {};
        dataChannels = {};
        manualDc = false;
        constructor(id, myId, opt) {
            super();
            let env = {};
            if (typeof window !== "undefined") {
                env = window;
            }
            if (typeof global !== "undefined") {
                env = global;
            }
            this._debugger = Debugger(`RTC ${id}:`, true)
            this.RTCPeerConnection = opt?.RTCPeerConnection || env.RTCPeerConnection || env.webkitRTCPeerConnection || env.mozRTCPeerConnection;
            this.RTCSessionDescription = opt?.RTCSessionDescription || env.RTCSessionDescription || env.webkitRTCSessionDescription || env.mozRTCSessionDescription;
            this.RTCIceCandidate = opt?.RTCIceCandidate || env.RTCIceCandidate || env.webkitRTCIceCandidate || env.mozRTCIceCandidate;
            this.initPeerConnection = opt?.rtcConfig || {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun.sipgate.net:3478" }
                ]
            };
            this.initDataChannel = opt?.dataChannel || {
                ordered: true,
                maxRetransmits: 3
            };
            this.initOffer = opt?.offer || {
                iceRestart: false,
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            };
            this.polite = [id, myId].sort()[0] === id;
            this.wait = opt?.startWait || opt?.minWait || 15 * 1e3;
            this.retry = opt?.maxRetry || 8;
            this.waitInc = opt?.waitInc || 2;
            this.maxWait = opt?.maxWait || 30 * 1e3;
            this.minWait = opt?.minWait || 10 * 1e3;
            this.maxRetry = opt?.maxRetry || 8;
            this.id = id;
            this.myId = myId;
            this.on("recv-signal", (msg) => {
                this.receive(msg);
            });
        }
        async connect() {
            if (this.retry <= 0 || this.manualDc)
                return;
            this._debugger.log("((reconnect))", this.retry, this.wait);
            this.disconnect("bye");
            this.manualDc = false
            this.emit("send-signal", { hi: this.myId, ts: +/* @__PURE__ */ new Date() });
            this._debugger.log("::hi send::");
            clearTimeout(this.defer);
            this.defer = setTimeout(() => this.connect(), this.wait);
            this.retry = this.retry - (-this.lastTried + (this.lastTried = +/* @__PURE__ */ new Date()) < this.wait * this.waitInc ? 1 : 0);
            this.wait = Math.min(this.wait * this.waitInc, this.maxWait);
        }
        
        disconnect(reason) {
            this.clearReconnect();
            this._debugger.log("::close::", reason);
            if (this.pc) {
                for (const channelId in this.dataChannels) {
                    this.disconnectDataChannel(channelId);
                }
                for (const streamId in this.mediaStreams) {
                    this.disconnectStream(this.mediaStreams[streamId]);
                }
                this.pc.close();
                this.pc = void 0;
            }
            this.setConnected(false);
            this.hiReceive = false;
            if (reason !== "clear") {
                this.manualDc = true
            }
            if (reason !== "bye" && reason !== "clear") {
                this._debugger.log("::bye send::");
                this.emit("send-signal", { ts: +/* @__PURE__ */ new Date(), bye: "bye" });
            }
        }
        addStream(stream) {
            if (this.mediaStreams[stream.id])
                return;
            this._debugger.log("{{stream}} add", stream.id, stream.getTracks());
            this.mediaStreams[stream.id] = stream;
            for (const track of stream.getTracks()) {
                if (this.pc) {
                    this.tracksRtpSenders[track.id] = this.pc.addTrack(track, stream);
                    console.log(this.tracksRtpSenders[track.id]);
                }
            }
        }
        removeStream(stream) {
            this.disconnectStream(stream);
            delete this.mediaStreams[stream.id];
        }
        disconnectStream(stream) {
            if (!this.mediaStreams[stream.id])
                return;
            this._debugger.log("{{stream}} disconnect", stream.id);
            for (const track of stream.getTracks()) {
                if (this.pc)
                    this.pc.removeTrack(this.tracksRtpSenders[track.id]);
                delete this.tracksRtpSenders[track.id];
            }
        }
        makingOffer = false;
        polite;
        hiReceive = false;
        async receive(msg) {
            try {
                if (!msg)
                    return;
                let { candidate, description, bye, hi } = msg;
                if (bye && (this.isConnected || +/* @__PURE__ */ new Date() - this.lastTried > this.wait * this.waitInc)) {
                    this._debugger.log("::bye::");
                    this.manualDc = true
                    this.disconnect("bye");
                    return;
                }
                if (hi && !this.hiReceive) {
                    this._debugger.log("::hi::");
                    this.hiReceive = true;
                    this.emit("send-signal", { hi: this.myId, ts: +/* @__PURE__ */ new Date() });
                    this._debugger.log("::hi send::");
                    await this.sendOffer();
                    return;
                }
                if (!this.pc) {
                    return;
                }
                let pc = this.pc;
                if (description) {
                    const offerCollision = description.type == "offer" && (this.makingOffer || pc.signalingState != "stable");
                    let ignoreOffer = !this.polite && offerCollision;
                    if (ignoreOffer) {
                        this._debugger.log("::offer:: ignore");
                        return;
                    }
                    if (offerCollision) {
                        this._debugger.log("::offer:: rollback");
                        await Promise.all([
                            pc.setLocalDescription({ type: "rollback" }),
                            pc.setRemoteDescription(description)
                        ]);
                    } else {
                        this._debugger.log(`::${description.type}:: accept`);
                        await pc.setRemoteDescription(description);
                    }
                    if (description.type == "offer") {
                        let answer = await pc.createAnswer(this.initOffer);
                        await pc.setLocalDescription(answer);
                        this._debugger.log("::answer:: send");
                        this.emit("send-signal", {
                            description: answer,
                            ts: +/* @__PURE__ */ new Date()
                        });
                    }
                    if (pc.remoteDescription) {
                        this._debugger.log("{{ice apply cache}}");
                        for (let candidate2 of this.pendingICECandidate) {
                            await pc.addIceCandidate(candidate2);
                        }
                        this.pendingICECandidate = [];
                    }
                    return;
                }
                if (candidate) {
                    if (!pc.remoteDescription) {
                        this._debugger.log("::ice:: cache");
                        (this.pendingICECandidate ??= []).push(candidate);
                        return;
                    }
                    this._debugger.log("::ice::");
                    await pc.addIceCandidate(candidate);
                    return;
                }
            } catch (e) {
                if (e.name === "InvalidStateError")
                    return;
                this._debugger.error("::receive::", e);
            }
        }
        async sendOffer() {
            if (!this.pc)
                this.createPeer();
            let pc = this.pc;
            try {
                this.makingOffer = true;
                let offer = await pc.createOffer(this.initOffer);
                if (pc.signalingState != "stable") {
                    this._debugger.log("::offer:: send cancel");
                    return;
                }
                ;
                await pc.setLocalDescription(offer);
                this._debugger.log("::offer:: send");
                this.emit("send-signal", {
                    description: offer,
                    ts: +/* @__PURE__ */ new Date()
                });
            } catch (e) {
                this._debugger.error("::offer:: send", e);
            } finally {
                this.makingOffer = false;
            }
        }
        resetReconnect(restart) {
            this._debugger.log("{{reconnect}} reset");
            this.clearReconnect();
            this.wait = restart ? this.minWait : this.maxWait;
            this.defer = setTimeout(() => this.connect(), this.wait);
        }
        clearReconnect(restart) {
            this._debugger.log("{{reconnect}} clear");
            clearTimeout(this.defer);
            this.retry = restart ? this.maxRetry || 8 : this.retry;
        }
        _connected = false;
        get isConnected() {
            return this._connected;
        }
        setConnected(connected) {
            this._connected = connected;
            if (connected) {
                this.emit("connected", this.pc);
                this.clearReconnect();
            } else
                this.emit("disconnected");
        }
        createPeer() {
            this._debugger.log("{{create peer}}");
            if (this.pc)
                this.disconnect("clear");
            let pc = this.pc = new this.RTCPeerConnection(this.initPeerConnection);
            const ins = this;
            function onOpen() {
                ins.clearReconnect();
                ins._debugger.log("::ping:: send");
                this.send("ping");
            }
            let closeCalled = false;
            function onClose() {
                if (!closeCalled) {
                    closeCalled = true;
                    return;
                }
                ins.disconnect("clear");
                if (!ins.manualDc) {
                    ins.resetReconnect(true);
                } else {
                    console.log("manual dc")
                }
            }
            function onError() {
                ins.disconnect("clear");
                if (!ins.manualDc) {
                    ins.resetReconnect(true);
                } else {
                    console.log("manual dc")
                }
            }
            function onMessage(ev) {
                if (ev.data === "pong") {
                    ins._debugger.log("::pong:: recv");
                    ins.clearReconnect(true);
                    ins.setConnected(true);
                } else if (ev.data === "ping") {
                    ins._debugger.log("::ping:: recv");
                    ins._debugger.log("::pong:: send");
                    this.send("pong");
                }
                if (!ins.isConnected)
                    ins.resetReconnect();
            }
            pc.addEventListener("icecandidate", (e) => {
                if (!e.candidate)
                    return;
                this._debugger.log("::ice:: send");
                this.emit("send-signal", {
                    candidate: e.candidate,
                    ts: +/* @__PURE__ */ new Date()
                });
            });
            pc.addEventListener("datachannel", (e) => {
                this._debugger.log("{{data channel}} in", e.channel.label);
                let dc = e.channel;
                let ch;
                const { onmessage, onopen, onerror, onclose, onbufferedamountlow } = ch = this.dataChannels[dc.label] || {};
                if (ch) {
                    dc.addEventListener("message", onmessage);
                    if (onopen)
                        dc.addEventListener("open", onopen);
                    if (onclose)
                        dc.addEventListener("close", onclose);
                    if (onerror)
                        dc.addEventListener("error", onerror);
                    if (onbufferedamountlow)
                        dc.addEventListener("bufferedamountlow", onbufferedamountlow);
                    dc.addEventListener("error", () => ch.channel = void 0);
                    dc.addEventListener("close", () => ch.channel = void 0);
                    dc.addEventListener("open", () => this.emit("data-channel", dc));
                    ch.channel = dc;
                }
            });
            pc.addEventListener("signalingstatechange", (e) => {
                this._debugger.log("{{signaling state}} ", pc.signalingState);
            });
            pc.addEventListener("connectionstatechange", (e) => {
                this._debugger.log("{{connection state}} ", pc.connectionState);
            });
            pc.addEventListener("iceconnectionstatechange", (e) => {
                this._debugger.log("{{ice connection state}} ", pc.iceConnectionState);
            });
            pc.addEventListener("track", (e) => {
                const { track, streams } = e;
                let str = [...streams];
                this._debugger.log("{{track}} ", e);
                if (str.length === 0)
                    str = [new MediaStream([track])];
                for (const s of str) {
                    this.emit("stream", s);
                }
                track.addEventListener("ended", () => {
                    for (const s of str) {
                        s.removeTrack(track);
                    }
                });
            });
            pc.addEventListener("negotiationneeded", (e) => this.sendOffer());
            this.addDataChannel("init", onMessage, onOpen, onClose, onError);
            for (const stream of Object.values(this.mediaStreams)) {
                for (const track of stream.getTracks()) {
                    this.tracksRtpSenders[track.id] = pc.addTrack(track, stream);
                }
            }
            for (const channel of Object.values(this.dataChannels)) {
                this.createDataChannel(channel);
            }
            return pc;
        }
        addDataChannel(name, onmessage, onopen, onclose, onerror, onbufferedamountlow) {
            let ch = this.dataChannels[name] ??= {};
            ch.name = name;
            ch.onmessage = onmessage;
            ch.onopen = onopen;
            ch.onclose = onclose;
            ch.onerror = onerror;
            ch.onbufferedamountlow = onbufferedamountlow;
            if (ch.channel?.readyState === "open")
                this.emit("data-channel", ch.channel);
            else if (!ch.channel || ch.channel.readyState === "closed" || ch.channel.readyState === "closing")
                this.createDataChannel(ch);
        }
        createDataChannel(ch) {
            if (!this.pc)
                return;
            this._debugger.log("{{data-channel}} create", ch.name);
            if (ch.channel)
                try {
                    ch.channel.close();
                } catch {
                }
            let dc = ch.channel = this.pc.createDataChannel(ch.name);
            dc.addEventListener("message", ch.onmessage);
            if (ch.onopen)
                dc.addEventListener("open", ch.onopen);
            if (ch.onclose)
                dc.addEventListener("close", ch.onclose);
            if (ch.onerror)
                dc.addEventListener("error", ch.onerror);
            if (ch.onbufferedamountlow)
                dc.addEventListener("bufferedamountlow", ch.onbufferedamountlow);
            dc.addEventListener("error", () => ch.channel = void 0);
            dc.addEventListener("close", () => ch.channel = void 0);
            dc.addEventListener("open", () => this.emit("data-channel", dc));
            return dc;
        }
        manageDataChannel(dc, onmessage, onopen, onclose, onerror, onbufferedamountlow) {
            let ch = this.dataChannels[dc.label] ??= {};
            if (!(dc.label in (this.pc?.channels || {})) || ch.channel && ch.channel.readyState === "open")
                return;
            ch.channel = dc;
            dc.addEventListener("message", onmessage);
            if (onopen)
                dc.addEventListener("open", onopen);
            if (onclose)
                dc.addEventListener("close", onclose);
            if (onerror)
                dc.addEventListener("error", onerror);
            if (onbufferedamountlow)
                dc.addEventListener("bufferedamountlow", onbufferedamountlow);
            dc.addEventListener("error", () => ch.channel = void 0);
            dc.addEventListener("close", () => ch.channel = void 0);
            return dc;
        }
        removeDataChannel(name) {
            this._debugger.log("{{data-channel}} delete", name);
            this.disconnectDataChannel(name);
            delete this.dataChannels[name];
        }
        disconnectDataChannel(name) {
            let ch;
            if (!(ch = this.dataChannels[name]))
                return;
            if (ch.channel) {
                let dc = ch.channel;
                dc.close();
                ch.channel = void 0;
            }
        }
        sendDataChannel(name, data) {
            const exists = this.isDataChannelExists(name);
            if (!exists)
                return exists;
            this.dataChannels[name].channel.send(data);
            return exists;
        }
        isDataChannelExists(name) {
            let ch;
            if (!(ch = this.dataChannels[name]))
                return false;
            if (!ch.channel || ch.channel.readyState !== "open")
                return false;
            return true;
        }
        isDataChannelManaged(name) {
            let m = this.isDataChannelExists(name);
            if (m)
                return true;
            m = !!this.pc?.channels[name];
            if (m)
                return false;
            return void 0;
        }
    }
    window.RTCPeer = RTCPeer
})

