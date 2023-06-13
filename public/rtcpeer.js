const DEBUG = true
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
        manualDc = false;
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
                iceRestart: true,
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            };
            this.polite = [id, myId].sort()[0] === id;
            this.wait = opt?.startWait || opt?.minWait || 15 * 1e3;
            this.retry = opt?.maxRetry || 1008;
            this.waitInc = opt?.waitInc || 2;
            this.maxWait = opt?.maxWait || 11 * 1e3;
            this.minWait = opt?.minWait || 10 * 1e3;
            this.maxRetry = opt?.maxRetry || 100;
            this.id = id;
            this.myId = myId;
            this.on("recv-signal", (msg) => {
                this.receive(msg);
            });
        }
        async connect() {
            if (this.retry <= 0 || this.manualDc)
                return;
            _debugger.log("((reconnect))", this.retry, this.wait);
            this.disconnect("bye");
            this.manualDc = false;
            this.emit("send-signal", { hi: this.myId, ts: +/* @__PURE__ */ new Date() });
            _debugger.log("::hi send::");
            clearTimeout(this.defer);
            this.defer = setTimeout(() => this.connect(), this.wait);
            this.retry = this.retry - (-this.lastTried + (this.lastTried = +/* @__PURE__ */ new Date()) < this.wait * this.waitInc ? 1 : 0);
            this.wait = Math.min(this.wait * this.waitInc, this.maxWait);
        }
        disconnect(reason) {
            this.clearReconnect();
            _debugger.log("::close::");
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
                this.manualDc = true;
            }
            if (reason !== "bye" && reason !== "clear") {
                _debugger.log("::bye send::");
                this.emit("send-signal", { ts: +/* @__PURE__ */ new Date(), bye: "bye" });
            }
        }
        addStream(stream) {
            if (this.mediaStreams[stream.id])
                return;
            _debugger.log("{{stream}} add", stream.id, stream.getTracks());
            this.mediaStreams[stream.id] = stream;
            for (const track of stream.getTracks()) {
                if (this.pc) {
                    this.tracksRtpSenders[track.id] = this.pc.addTrack(track, stream);
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
            _debugger.log("{{stream}} disconnect", stream.id);
            for (const track of stream.getTracks()) {
                if (this.pc)
                    this.pc.removeTrack(this.tracksRtpSenders[track.id]);
                delete this.tracksRtpSenders[track.id];
            }
        }
        makingOffer = false;
        polite;
        hiReceive = false;
        hiDefer = undefined;
        async receive(msg) {
            try {
                if (!msg) {
                    _debugger.log("::no msg::");
                    return
                }

                _debugger.log("::=======msg=======::", msg);
                    
                let { candidate, description, bye, hi } = msg;
                if (bye && (this.isConnected || +/* @__PURE__ */ new Date() - this.lastTried > this.wait * this.waitInc)) {
                    _debugger.log("::bye::");
                    this.manualDc = true;
                    this.disconnect("bye");
                    return;
                }
                if (hi && !this.hiReceive) {
                    _debugger.log("::hi::");
                    this.hiReceive = true;
                    this.emit("send-signal", { hi: this.myId, ts: +/* @__PURE__ */ new Date() });
                    _debugger.log("::hi send::");
                    await this.sendOffer();
                    clearTimeout(this.hiDefer)
                    this.hiDefer = setTimeout(() => this.hiReceive = false, 15000)
                    return;
                }
                if (!this.pc) {
                    _debugger.log("::no pc::");
                    return;
                }
                let pc = this.pc;
                if (description) {
                    const offerCollision = description.type == "offer" && (this.makingOffer || pc.signalingState != "stable");
                    let ignoreOffer = !this.polite && offerCollision;
                    if (ignoreOffer) {
                        _debugger.log("::offer:: ignore");
                        return;
                    }
                    if (offerCollision) {
                        _debugger.log("::offer:: rollback");
                        await Promise.all([
                            pc.setLocalDescription({ type: "rollback" }),
                            pc.setRemoteDescription(description)
                        ]);
                    } else {
                        _debugger.log(`::${description.type}:: accept`);
                        await pc.setRemoteDescription(description);
                    }
                    if (description.type == "offer") {
                        let answer = await pc.createAnswer(this.initOffer);
                        await pc.setLocalDescription(answer);
                        _debugger.log("::answer:: send");
                        this.emit("send-signal", {
                            description: answer,
                            ts: +/* @__PURE__ */ new Date()
                        });
                    }
                    if (pc.remoteDescription) {
                        _debugger.log("{{ice apply cache}}");
                        await pc.addIceCandidate(this.pendingICECandidate[this.pendingICECandidate.length]);
                        this.pendingICECandidate = [];
                    }
                    return;
                }
                if (candidate) {
                    if (!pc.remoteDescription) {
                        _debugger.log("::ice:: cache");
                        (this.pendingICECandidate ??= []).push(candidate);
                        return;
                    }
                    _debugger.log("::ice::");
                    await pc.addIceCandidate(candidate);
                    return;
                }

                _debugger.log("::not catched!::", msg);
            } catch (e) {
                if (e.name === "InvalidStateError")
                    return;
                _debugger.error("::receive::", e);
            }
        }
        async sendOffer() {
            if (!this.pc)
                this.createPeer();
            let pc = this.pc;
            var offer;
            try {
                this.makingOffer = true;
                offer = await pc.createOffer(this.initOffer);
                if (pc.signalingState != "stable") {
                    _debugger.log("::offer:: send cancel");
                    return;
                }
                ;
                await pc.setLocalDescription(offer);
                _debugger.log("::offer:: send");
                this.emit("send-signal", {
                    description: offer,
                    ts: +/* @__PURE__ */ new Date()
                });
            } catch (e) {
                _debugger.error("::offer:: send", e);
            } finally {
                this.makingOffer = false;
            }
        }
        resetReconnect(restart) {
            _debugger.log("{{reconnect}} reset");
            this.clearReconnect();
            this.wait = restart ? this.minWait : this.maxWait;
            this.defer = setTimeout(() => this.connect(), this.wait);
        }
        clearReconnect(restart) {
            _debugger.log("{{reconnect}} clear");
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
            _debugger.log("{{create peer}}");
            if (this.pc)
                this.disconnect("clear");
            let pc = this.pc = new this.RTCPeerConnection(this.initPeerConnection);
            const ins = this;
            function onOpen() {
                pc.addEventListener("negotiationneeded", (e) => ins.sendOffer());
                ins.clearReconnect();
                _debugger.log("::ping:: send");
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
                    _debugger.log("<<manual dc>>");
                }
            }
            function onError() {
                ins.disconnect("clear");
                if (!ins.manualDc) {
                    ins.resetReconnect(true);
                } else {
                    _debugger.log("<<manual dc>>");
                }
            }
            function onMessage(ev) {
                if (ev.data === "pong") {
                    _debugger.log("::pong:: recv");
                    ins.clearReconnect(true);
                    ins.setConnected(true);
                } else if (ev.data === "ping") {
                    _debugger.log("::ping:: recv");
                    _debugger.log("::pong:: send");
                    this.send("pong");
                }
                if (!ins.isConnected)
                    ins.resetReconnect();
            }
            pc.addEventListener("icecandidate", (e) => {
                if (!e.candidate)
                    return;
                _debugger.log("::ice:: send");
                this.emit("send-signal", {
                    candidate: e.candidate,
                    ts: +/* @__PURE__ */ new Date()
                });
            });
            pc.addEventListener("datachannel", (e) => {
                _debugger.log("{{data channel}} in", e.channel.label);
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
                _debugger.log("{{signaling state}} ", pc.signalingState);
            });
            pc.addEventListener("connectionstatechange", (e) => {
                _debugger.log("{{connection state}} ", pc.connectionState);
            });
            pc.addEventListener("iceconnectionstatechange", (e) => {
                _debugger.log("{{ice connection state}} ", pc.iceConnectionState);
            });
            pc.addEventListener("track", (e) => {
                const { track, streams } = e;
                let str = [...streams];
                _debugger.log("{{track}} ", e);
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
            _debugger.log("{{data-channel}} create", ch.name);
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
            _debugger.log("{{data-channel}} delete", name);
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

