// 1KB of lorem
LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur dapibus auctor interdum. Pellentesque diam magna, pulvinar a nisi sit amet, varius volutpat diam. Fusce pharetra vehicula felis sit amet porta. In hac habitasse platea dictumst. Duis ac dictum erat, porttitor dictum quam. Etiam pharetra posuere fermentum. Donec laoreet iaculis maximus. Sed tempor, nisi sit amet iaculis viverra, orci lacus consectetur dui, a placerat velit ex quis dui. Integer efficitur risus a felis tempor, at ornare enim hendrerit. Suspendisse pellentesque ante at sem egestas elementum. Vestibulum ac enim est. Curabitur porta felis in neque convallis, id iaculis justo imperdiet. Ut pretium enim risus, a iaculis velit varius at. Donec sollicitudin, neque et placerat scelerisque, odio enim lobortis ante, ut rutrum ligula odio vitae metus. Donec ligula risus, auctor et arcu non, fermentum aliquet ligula. Sed sagittis leo purus, sed ultrices justo fringilla rutrum. Donec tellus lectus, posuere ac accumsan eget, feugiat in nisl. N"

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
    if (pair) {
        user.auth(pair)
    }
    return { gun, user }
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
        by: pair.pub,
        fill: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur dapibus auctor interdum. Pellentesque diam magna, pulvinar a nisi sit amet, varius volutpat diam. Fusce pharetra vehicula felis sit amet porta. In hac habitasse platea dictumst. Duis ac dictum erat, porttitor dictum quam. Etiam pharetra posuere fermentum. Donec laoreet iaculis maximus. Sed tempor, nisi sit amet iaculis viverra, orci lacus consectetur dui, a placerat velit ex quis dui. Integer efficitur risus a felis tempor."
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

async function encryptChat(pair, secret, msg) {
    let enc = await SEA.encrypt(msg, secret)
    let sig = await SEA.sign(enc, pair)
    return sig
}

async function decryptChat(pub, secret, sig) {
    let enc = await SEA.verify(sig, pub)
    let msg = await SEA.decrypt(enc, secret)
    return msg
}

function randInt(a, b) {
    let min = b === undefined ? 0 : a
    let max = b === undefined ? a : b
    let _m = max - min + 1
    return Math.floor(Math.random() * _m) + min;
}