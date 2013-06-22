
var concat = function(a) {
    return function(b) {
        return function(c) {
            return a + '\t' + b + '\t' + c
        }
    }
}

var fmt = lift(function(v) {
    return "B mouse move = " + JSON.stringify(v)
})(mouse)

var a = lift(concat)(fmt)

var b = apply(a)(tick)

var c = apply(b)(key)

var d = output(print)(c)

// incr : Num -> Num -> Num
var incr = function(tick) {
    return function(last) {
        return last + 1
    }
}

var count = foldp(incr)(0)(tick)

var e = output(print)(count)

var canvas = document.getElementById("full")
var ctx = canvas.getContext("2d")
var draw = function(m) {
    ctx.save()
    ctx.setTransform(1,0,0,1,0,0)
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.restore()
    ctx.fillRect(0, 0, m.x, m.y)
}

var f = output(draw)(mouse)

