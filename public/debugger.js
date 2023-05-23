function Debugger(namespace, gState) {
    let obj = {
        toggle: () => {
            state = !state
            update()
        }
    }
    const update = () => {
        if (state) {
          for (var m in console)
            if (typeof (console)[m] == 'function')
                obj[m] = (console)[m].bind(window.console, `${namespace}:`)
        } else {
          for (var m in console)
            if (typeof (console)[m] == 'function')
                obj[m] = function(){}
        }
    }
    var state = gState
    if (typeof window !== "undefined")
        update()
    return obj
}