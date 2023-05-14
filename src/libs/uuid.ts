export function randStr(l?: number, c?: string){
    var s = '';
    l = l || 24; // you are not going to make a 0 length random number, so no need to check type
    c = c || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXZabcdefghijklmnopqrstuvwxyz';
    while(l-- > 0){ s += c.charAt(Math.floor(Math.random() * c.length)) }
    return s;
}

export function uuid(l?: number){ 
    return (+new Date).toString(36).replace('.','') + randStr(l||24) 
}