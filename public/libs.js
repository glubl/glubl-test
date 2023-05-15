async function getUserPath(path, salt, times) {
    var res = path
    var i = times || 5
    while (i > 0) {
        res = await SEA.work(res, null, null, {encode: "utf8", salt: salt || ""})
        if (!res)
            throw new HashFail()
        i--
    }
    res = await SEA.work(res, null, null, {name: "SHA-256"})
    return res
}

async function initGun(peer, pair) {
    const gun = Gun(peer)
    const user = gun.user()
    user.auth(pair)
    return {gun,user}
}

async function addFriend(user, pair, friend) {
    const secret = await SEA.secret(friend.epub, pair)
    const [friendPath, myPath] = await Promise.all([await getUserPath(friend.pub, secret), await getUserPath(pair.pub, secret)])
    const friendGun = user.get("spaces").get(friendPath).put({})
    
    return new Promise((res, rej) => {
        const myGun = gun.get("~"+friend.pub).get("spaces").on((v, k, _, e) => {
            console.log(v, myPath, friendPath, myPath in v)
            if (myPath in v) {
                res({ secret, friendPath, friendGun, myGun })
                e.off()
            }
        }).get(myPath)
    })
}

async function sendChat(gun, pair, secret, msg) {
    let payload = {
        msg: msg,
        by: pair.pub
    }
    let enc = await SEA.encrypt(payload, secret)
    let sig = await SEA.sign(enc, pair)
    return new Promise((res, rej) => {
        let ts = +new Date
        gun.put({d: sig, ts: ts}, (ack) => {
            console.log(ack)
            res(ts)
        })
    })
}

async function decryptChat(friendPub, secret, sig) {
    let enc = await SEA.verify(sig, friendPub)
    let msg = await SEA.decrypt(enc, secret)
    return msg
}