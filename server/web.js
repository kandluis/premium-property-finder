var express = require("express");
var url = require('url');
var redis = require('redis');

var redisURL = url.parse(process.env.REDISCLOUD_URL);
var client = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
client.auth(redisURL.auth.split(":")[1]);

var app = express();

app.get('/api', function(req, res) {
  switch (req.query.a) {
    case "set":
      res.send(client.set("welcome_msg", "Hello from Redis!"));
      break;
    case "get":
      client.get("welcome_msg", function (err, reply) {
        if (reply != null) {
          res.send(reply);
        } else {
          res.send("Error");
        }
      });
      break;
    case "info":
      client.info(function (err, reply) {
        if (reply != null) {
          res.send(reply);
       } else {
          res.send("Error");
        }
      });
      break;
    case "flush":
      client.flushdb(function (err, reply) {
        if (reply != null) {
           res.send(reply);
        } else {
          res.send("Error");
        }
      });
      break;
    default:
      res.send("");
  }
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
