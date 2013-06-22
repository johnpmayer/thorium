
var guid7 = function() {
    return ((Math.random() * 0x10000000)|0).toString(16)
}

var inputs = {}
var nodes = {}

var notify = function(node, changed, value, parentId) {
    if (!changed && value) {
        throw "Sent a value with no change"
    }
    if (changed && !value) {
        throw "Sent no value with a change"
    }
    setTimeout(function() {
        node.receive(changed, value, parentId)
    }, 0)
}

var receive = function(nodeId, value) {
    _.each(_.pairs(inputs), function(input) {
        var changed = (nodeId === input[0])
        var fwdValue = changed ? value : undefined
        notify(input[1], changed, fwdValue, undefined)
    })
}

var baseNode = new (function() {
    
    this._super = function() {
        this.children = []
        this.guid = guid7()
        nodes[this.guid] = this
    }
    
    this._parent = function(parent) {
        return parent.registerChild(this)
    }
    
    this.registerChild = function(node) {
        this.children.push(node)
        return this.value
    }
    
    this.signalChildren = function(changed, value) {
        var guid = this.guid
        _.each(this.children, function(child) {
            notify(child, changed, value, guid)
        })
    }

    this.receive = function(changed, value, parentId) {
        if (changed) {
            this.value = value
        }
        var fwdValue = changed ? this.value : undefined
        this.signalChildren(changed, fwdValue)
    }

})()

// Provide an initial value. Use the guid to notify events
var Input = function(initial) {
    
    this._super()
    this.value = initial
    inputs[this.guid] = this

}
Input.prototype = baseNode

// Provide an I/O-like action to run on change event of parent
var Output = function(action, parent) {
    
    this._super()
    var parentValue = this._parent(parent)
    this.receive = function(changed, value, parentId) {
        if (changed) {
            action(value)
        }
    }
    action(parentValue)
    
}
Output.prototype = baseNode

var output = function(action) {
    return function(input) {
        return new Output(action, input)
    }
}

// Provide a pure function to transform the output of parent
var Lift = function(f, parent) {

    this._super()
    var parentValue = this._parent(parent)
    this.value = f(parentValue)
    this.receive = function(changed, value, parentId) {
        if (changed) {
            this.value = f(value)
        }
        var fwdValue = changed ? this.value : undefined
        this.signalChildren(changed, fwdValue)
    }

}
Lift.prototype = baseNode

var lift = function(f) {
    return function(input) {
        var output = new Lift(f,input)
        return output
    }
}

// Provide a lifted function and a lifted argument, and apply whenever either changes
var Apply = function(fParent, argParent) {

    this._super()
   
    this.lastF = this._parent(fParent)
    this.lastArg = this._parent(argParent)
    this.value = this.lastF(this.lastArg)
   
    var fParentId = fParent.guid
    var argParentId = argParent.guid

    this.fQueue = []
    this.argQueue = []

    this.receive = function(changed, value, parentId) {
        if ((this.lastArg == null) || (this.lastF == null)) {
            throw "Missing one of the saved values"
        }
        if (parentId === fParentId) {
            var fChanged = changed
            var f = value
            if (this.argQueue.length === 0) {
                this.fQueue.push({changed:fChanged,value:f})
            } else {
                var poppedArg = this.argQueue.shift()
                if (fChanged && poppedArg.changed) {
                    this.lastF = f
                    this.lastArg = poppedArg.value
                    this.value = f(poppedArg.value)
                } else if (fChanged) {
                    this.lastF = f
                    this.value = f(this.lastArg)
                } else if (poppedArg.changed) {
                    this.lastArg = poppedArg.value
                    this.value = this.lastF(poppedArg.value)
                }
                var fwdChanged = fChanged || poppedArg.changed
                var fwdValue = fwdChanged ? this.value : undefined
                this.signalChildren(fwdChanged, fwdValue)
            }
        }
        if (parentId === argParentId) {
            var argChanged = changed
            var arg = value
            if (this.fQueue.length === 0) {
                this.argQueue.push({changed:argChanged, value:arg})
            } else {
                var poppedF = this.fQueue.shift()
                if (argChanged && poppedF.changed) {
                    this.lastArg = arg
                    this.lastF = poppedF.value
                    this.value = poppedF.value(arg)
                } else if (argChanged) {
                    this.lastArg = arg
                    this.value = this.lastF(arg)
                } else if (poppedF.changed) {
                    this.lastF = poppedF.value
                    this.value = poppedF.value(this.lastArg)
                }
                var fwdChanged = argChanged || poppedF.changed
                var fwdValue = fwdChanged ? this.value : undefined
                this.signalChildren(fwdChanged, fwdValue)
            }
        }
    }

}
Apply.prototype = baseNode

var apply = function(sfab) {
    return function(sa) {
        var sb = new Apply(sfab,sa)
        return sb
    }
}

// Provide two signals, when the first signal changes, send the last value of the second
// trigger : Signal a
// hose : Signal b
var SampleOn = function(trigger, hose) {

    this._super()
   
    this._parent(trigger)
    this.value = this._parent(hose)
   
    var triggerId = trigger.guid
    var hoseId = hose.guid

    this.triggerQueue = []
    this.hoseQueue = []

    this.receive = function(changed, value, parentId) {
        if (this.value == null) {
            throw "Missing the saved hose value"
        }
        if (parentId === triggerId) {
            var triggerChanged = changed
            if (this.hoseQueue.length === 0) {
                this.triggerQueue.push({changed:triggerChanged})
            } else {
                var poppedHose = this.hoseQueue.shift()
                if (poppedHose.changed) {
                    this.value = poppedHose.value
                }
                var fwdChanged = triggerChanged
                var fwdValue = fwdChanged ? this.value : undefined
                this.signalChildren(fwdChanged, fwdValue)
            }
        }
        if (parentId === hoseId) {
            var hoseChanged = changed
            var hose = value
            if (this.triggerQueue.length === 0) {
                this.hoseQueue.push({changed:hoseChanged, value:hose})
            } else {
                var poppedTrigger = this.triggerQueue.shift()
                if (hoseChanged) {
                    this.value = hose
                }
                var fwdChanged = poppedTrigger.changed
                var fwdValue = fwdChanged ? this.value : undefined
                this.signalChildren(fwdChanged, fwdValue)
            }
        }
    }

}
SampleOn.prototype = baseNode

var sampleOn = function(trigger) {
    return function(hose) {
        return new SampleOn(trigger, hose)
    }
}

var Loopback = function(initial) {
    this._super()
    this.value = initial
    this.first = true
    inputs[this.guid] = this
    this.receive = function(changed, value, parentId) {
        if (parentId) {
            if (changed) {
                this.value = value
            }
            var fwdValue = changed ? this.value : undefined
            this.signalChildren(changed, fwdValue)
        } else if (this.first) {
            this.signalChildren(false, undefined)
            this.first = false
        }
    }
}
Loopback.prototype = baseNode

// transform : (Signal a -> Signal b -> Signal b)
// initial : b
// trigger : Signal a
var loop = function(transform) {
    return function(initial) {
        return function(trigger) {
    
            var loopback = new Loopback(initial)
            var output = transform(trigger)(loopback)
            loopback._parent(output)
            return loopback
        }
    }
}

// combine : a -> b -> b
// initial : b
// trigger : Signal a
var foldp = function(combine) {
    return function(initial) {
        return function(trigger) {
            var lifted = function(sa) {
                return function(sb) {
                    return sampleOn(sa)(apply(lift(combine)(sa))(sb))
                }
            }
            return loop(lifted)(initial)(trigger)
        }
    }
}

// CREDIT : http://remysharp.com/2010/07/21/throttling-function-calls/
function throttle(fn, threshhold, scope) {
  threshhold || (threshhold = 250)
  var last
  var deferTimer
  return function () {
    var context = scope || this
    var now = +new Date
    var args = arguments
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer)
      deferTimer = setTimeout(function () {
        last = now
        fn.apply(context, args)
      }, threshhold)
    } else {
      last = now
      fn.apply(context, args)
    }
  }
}

var mouse = new Input({x:0,y:0})
window.onmousemove = throttle(function(e) {
    receive(mouse.guid, {x:e.x,y:e.y})
}, 50)

var key = new Input(-1)
window.onkeypress = function(e) {
    receive(key.guid, e.charCode)
}

var d = new Date()
var tick = new Input(d.getTime())
var tickWhile = function() {
    var d = new Date()
    receive(tick.guid, d.getTime())
    setTimeout(tickWhile, 1000)
}
tickWhile()

var print = function(stuff) {
    console.log(stuff)
}

