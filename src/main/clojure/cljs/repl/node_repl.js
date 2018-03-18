/**
 * Copyright (c) Rich Hickey. All rights reserved.
 * The use and distribution terms for this software are covered by the
 * Eclipse Public License 1.0 (http://opensource.org/licenses/eclipse-1.0.php)
 * which can be found in the file epl-v10.html at the root of this distribution.
 * By using this software in any fashion, you are agreeing to be bound by
 * the terms of this license.
 * You must not remove this notice, or any other, from this software.
 */

process.env.NODE_DISABLE_COLORS = true;
var net  = require("net");
var vm   = require("vm");
var dom  = require("domain").create();
var PORT = 5001;
var repl = null;

process.stdout.write = (function(write) {
    return function(chunk, encoding, fd) {
        var args = Array.prototype.slice.call(arguments, 0);
        args[0] = JSON.stringify({repl: repl, data: chunk});
        write.apply(process.stdout, args);
    };
})(process.stdout.write);

process.stderr.write = (function(write) {
    return function(chunk, encoding, fd) {
        var args = Array.prototype.slice.call(arguments, 0);
        args[0] = JSON.stringify({repl: repl, data: chunk});
        write.apply(process.stderr, args);
    };
})(process.stderr.write);

try {
    require("source-map-support").install();
} catch(err) {
}

var server = net.createServer(function (socket) {
    var buffer = "",
        ret    = null,
        err    = null;

    socket.write("ready");
    socket.write("\0");

    socket.setEncoding("utf8");

    dom.on("error", function(ue) {
        console.error(ue.stack);
    });

    socket.on("data", function(data) {
        if(data[data.length-1] != "\0") {
            buffer += data;
        } else {
            if(buffer.length > 0) {
                data = buffer + data;
                buffer = "";
            }

            if(data) {
                // not sure how \0's are getting through - David
                data = data.replace(/\0/g, "");

                if(":cljs/quit" == data) {
                    server.close();
                    socket.destroy();
                    return;
                } else {
                    try {
                        dom.run(function () {
                            var obj = JSON.parse(data);
                            repl = obj.repl;
                            ret = vm.runInThisContext(obj.form, "repl");
                        });
                    } catch (e) {
                        err = e;
                    }
                }
            }

            if(err) {
                socket.write(JSON.stringify({
                    status: "exception",
                    value: err.stack
                }));
            } else if(ret !== undefined && ret !== null) {
                socket.write(JSON.stringify({
                    status: "success",
                    value: ret.toString()
                }));
            } else {
                socket.write(JSON.stringify({
                    status: "success",
                    value: null
                }));
            }

            ret = null;
            err = null;

            socket.write("\0");
        }
    });

}).listen(PORT);
