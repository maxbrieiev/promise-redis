'use strict';

var redis = require('redis'),
    redisCmds = require('redis/lib/commands');

function createCb(resolve, reject) {
    return function (err, value) {
        if (err !== null) {
            reject(err);
        } else {
            resolve(value);
        }
    };
}

module.exports = function (promiseFactory) {
    var mlproto = redis.Multi.prototype;

    function promisify(f) {
        return function () {
            var args = Array.prototype.slice.call(arguments),
                that = this;
            if (typeof args[args.length - 1] === 'function') {
                // Okay. Someone supplied a callback. Most likely some internal
                // node-redis call (ready probe etc.). Oh, as a result of
                // supporting internal callback-style calls, one can now use
                // promise-redis as a dropin replacement for node-redis.
                f.apply(this, args);
            } else {
                return promiseFactory(function (resolve, reject) {
                    args.push(createCb(resolve, reject));
                    f.apply(that, args);
                });
            }
        };
    }

    redisCmds.forEach(function (fullCommand) {
        var cmd = fullCommand.split(' ')[0],
            clproto = redis.RedisClient.prototype;

        if (cmd !== 'multi') {
            clproto[cmd] = promisify(clproto[cmd]);
            clproto[cmd.toUpperCase()] = clproto[cmd];
        }

    });

    // For Multi only `exec` command returns promise.
    mlproto.exec = promisify(mlproto.exec);
    mlproto.EXEC = mlproto.exec;

    return redis;
};
