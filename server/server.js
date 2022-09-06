"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var body_parser_1 = require("body-parser");
// @ts-ignore
var cors_anywhere_1 = require("cors-anywhere");
var express_1 = require("express");
var get_port_1 = require("get-port");
var pg_1 = require("pg");
var redis_1 = require("redis");
var url_1 = require("url");
require("dotenv/config");
var tableName = 'properties';
var pgPool = new pg_1["default"].Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
if (!process.env.REDISCLOUD_URL) {
    throw Error('Need to define REDISCLOUD_URL in .env file.');
}
var redisURL = url_1["default"].parse(process.env.REDISCLOUD_URL);
if (!redisURL.hostname) {
    throw Error("Invalid redis url: " + (redisURL.query || ''));
}
var redisClient = redis_1["default"].createClient(Number(redisURL.port), redisURL.hostname || '', { no_ready_check: true });
if (redisURL.auth) {
    redisClient.auth(redisURL.auth.split(':')[1]);
}
/**
  Handle shutdown of server gracefully by closing all connections to backends.
*/
function end() {
    pgPool.end()
        .then(function () {
        redisClient.end(true);
        process.exit(0);
    })["catch"](function () { return process.exit(0); });
}
process.once('SIGTERM', end);
process.once('SIGINT', end);
/**
Fetches properties from persistence storage in string format.

@returns: The JSON object of properties as a JSON string, if any.
*/
function fetch() {
    return __awaiter(this, void 0, void 0, function () {
        var sqlQuery, query, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sqlQuery = "\n    SELECT blob\n    FROM " + tableName + "\n    WHERE version = (\n      SELECT MAX(version)\n      FROM " + tableName + "\n    )\n    LIMIT 1\n  ";
                    query = {
                        text: sqlQuery
                    };
                    return [4 /*yield*/, pgPool.query(query)];
                case 1:
                    res = _a.sent();
                    if (res.rows.length === 0) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, JSON.stringify(res.rows[0].blob)];
            }
        });
    });
}
/**
 Persists the given data at the specified version in storage.

 @param data - The JSON object to persist into storage.
 @param version - If provided, the version of the data to persist.
*/
function persist(data, version) {
    return __awaiter(this, void 0, void 0, function () {
        var definedVersion, resp, resultVersion, sqlQuery, query;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    definedVersion = 0;
                    if (!(typeof (version) !== 'undefined' && version != null)) return [3 /*break*/, 1];
                    definedVersion = version;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, pgPool.query({
                        text: "SELECT MAX(version) FROM " + tableName + " LIMIT 1"
                    })];
                case 2:
                    resp = _a.sent();
                    resultVersion = resp.rows[0].version;
                    if (typeof (resultVersion) !== 'undefined' && resultVersion != null) {
                        definedVersion = resultVersion;
                    }
                    _a.label = 3;
                case 3:
                    sqlQuery = "\n    INSERT INTO\n      " + tableName + " (version, blob)\n    VALUES\n      ($1, $2)\n    ON CONFLICT (version)\n    DO\n      UPDATE SET blob = EXCLUDED.blob\n  ";
                    query = {
                        text: sqlQuery,
                        values: [definedVersion, data]
                    };
                    return [4 /*yield*/, pgPool.query(query)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
  Refreshes the Redis in-memory store to match persistent storage.

  @returns - Whether or not the refresh operation succeeded.
*/
function refresh() {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch()];
                case 1:
                    db = _a.sent();
                    if (db == null) {
                        // Don't refresh on failure.
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, redisClient.set(tableName, db)];
            }
        });
    });
}
/**
  Middleware for the server.

  @remarks
    - Allows for dross origin requests.
    - Blocks any requests to the server with the Api-Key set.

  @parameter req - The request object.
  @parameter res - The response object.
  @parameter next - The next() callback.
*/
function allowCrossDomains(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Api-Key');
    // intercept OPTIONS method
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else if (req.header('Api-Key') !== process.env.SECRET) {
        res.sendStatus(403);
    }
    else {
        next();
    }
}
// Set-up proxy router.
var cors_proxy = cors_anywhere_1.createServer({
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: [
        'cookie',
        'cookie2',
        // Strip Heroku-specific headers
        'x-heroku-queue-wait-time',
        'x-heroku-queue-depth',
        'x-heroku-dynos-in-use',
        'x-request-start',
    ],
    redirectSameOrigin: true,
    httpProxyOptions: {
        // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
        xfwd: false
    }
});
var inCache = false;
var app = express_1["default"]()
    .use(body_parser_1["default"].json({ limit: '50mb' }))
    .use(body_parser_1["default"].urlencoded({ limit: '50mb', extended: true }))
    .use(allowCrossDomains);
var router = express_1["default"].Router()
    .get('/proxy/:proxyUrl*', function (req, res) {
    req.url = req.url.replace('/proxy/', '/');
    cors_proxy.emit('request', req, res);
})
    .post('/proxy/:proxyUrl*', function (req, res) {
    req.url = req.url.replace('/proxy/', '/');
    cors_proxy.emit('request', req, res);
})
    .get('/api', function (req, res) {
    res.send('alive');
})
    .post('/api/:action', function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, payload, data, blob, data, item;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = request.params.action;
                switch (_a) {
                    case 'refresh': return [3 /*break*/, 1];
                    case 'set': return [3 /*break*/, 3];
                    case 'get': return [3 /*break*/, 4];
                    case 'infodb': return [3 /*break*/, 8];
                    case 'infocache': return [3 /*break*/, 10];
                    case 'flush': return [3 /*break*/, 11];
                }
                return [3 /*break*/, 12];
            case 1:
                _c = (_b = response).json;
                _d = {};
                return [4 /*yield*/, refresh()];
            case 2:
                _c.apply(_b, [(_d.message = _e.sent(),
                        _d)]);
                return [3 /*break*/, 13];
            case 3:
                {
                    payload = request.body;
                    data = payload;
                    if (data.data) {
                        data = data.data;
                    }
                    persist(data, payload.version)
                        .then(null)["catch"](null);
                    blob = JSON.stringify(data);
                    inCache = redisClient.set(tableName, blob);
                    response.json({
                        message: inCache
                    });
                    return [3 /*break*/, 13];
                }
                _e.label = 4;
            case 4:
                if (!inCache) return [3 /*break*/, 5];
                redisClient.get(tableName, function (err, reply) {
                    if (reply != null) {
                        response.json(JSON.parse(reply));
                    }
                    else {
                        response.json({
                            message: err
                        });
                    }
                });
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, fetch()];
            case 6:
                data = _e.sent();
                if (data === null) {
                    response.json({});
                }
                else {
                    response.json(JSON.parse(data));
                }
                _e.label = 7;
            case 7: return [3 /*break*/, 13];
            case 8: return [4 /*yield*/, pgPool.query('SELECT version()')];
            case 9:
                item = _e.sent();
                response.json(item.rows[0]);
                return [3 /*break*/, 13];
            case 10:
                {
                    redisClient.info(function (err, reply) {
                        if (reply != null) {
                            response.send(reply);
                        }
                        else {
                            response.send({
                                message: err
                            });
                        }
                    });
                    return [3 /*break*/, 13];
                }
                _e.label = 11;
            case 11:
                {
                    redisClient.flushdb(function (err, reply) {
                        if (reply != null) {
                            response.json({
                                message: reply
                            });
                        }
                        else {
                            response.json({
                                message: err
                            });
                        }
                    });
                    return [3 /*break*/, 13];
                }
                _e.label = 12;
            case 12:
                {
                    response.json({
                        message: 'Not defined'
                    });
                }
                _e.label = 13;
            case 13: return [2 /*return*/];
        }
    });
}); });
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var port;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: 
            // Refresh the database before starting.
            return [4 /*yield*/, refresh()];
            case 1:
                // Refresh the database before starting.
                _a.sent();
                return [4 /*yield*/, get_port_1["default"]({
                        port: Number(process.env.PORT) || 5000
                    })];
            case 2:
                port = _a.sent();
                // Back-end server. 
                app.use('/', router)
                    .listen(port, function () {
                    console.log("Listening on " + port);
                });
                return [2 /*return*/];
        }
    });
}); })()
    .then(null)["catch"](null);
