var started = false;
var interval;
self.addEventListener('message', function(e){
    let dat = e.data
    switch (dat.type) {
        case 'start':
            if (!started){
                started = true;
                interval = setInterval(function(){
                    self.postMessage('tick');
                }, dat.interval);
            }
            break;
        case 'stop':
            clearInterval(interval);
            started = false;
            break;
    };
}, false);