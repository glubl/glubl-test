export const Debugger = function(this: any, namespace: string, gState: boolean): Console & {toggle: () => void} {
    var window
    let obj: any = {
        toggle: () => {
            state = !state
            update()
        }
    }
    const update = () => {
        if (state) {
          for (var m in console)
            if (typeof (console as any)[m] == 'function')
                obj[m] = (console as any)[m].bind(window.console, `${namespace}:`)
        } else {
          for (var m in console)
            if (typeof (console as any)[m] == 'function')
                obj[m] = function(){}
        }
    }
    var state = gState
    if (typeof window !== "undefined")
        update()
    return obj
  }