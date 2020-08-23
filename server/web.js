const bodyParser = require("body-parser");
const express = require("express");
const url = require('url');
const redis = require('redis');
const { Pool } = require('pg');
const { promisify } = require('util');


const tableName = 'properties';
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
pgPool.connect();

const redisURL = url.parse(process.env.REDISCLOUD_URL);
const redisClient = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
redisClient.auth(redisURL.auth.split(":")[1]);

/* handle SIGTERM and SIGINT (ctrl-c) nicely */
function end() {
  pgPool.end();
  redisClient.end(true);
  process.exit(0);
}
process.once('SIGTERM', end);
process.once('SIGINT', end);


// Fetches properties from persistence storage in string format.
async function fetch() {
  const sqlQuery = `
    SELECT blob
    FROM ${tableName}
    WHERE version = (
      SELECT MAX(version)
      FROM ${tableName}
    )
    LIMIT 1
  `;
  const query = {
    text: sqlQuery,
  };
  const res = await pgPool.query(query);
  if (res.rows.length == 0) {
    return null;
  }
  return JSON.stringify(res.rows[0].blob);
}

async function persist(data, version) {
  if (typeof(version) == 'undefined' || version == null) {
    const resp = await pgPool.query({
      text: `SELECT MAX(version) FROM ${tableName} LIMIT 1`,
    });
    version = resp.rows[0].version;
    if (typeof(version) == 'undefined' || version == null) {
      version = 0;
    }
  }
  const sqlQuery = `
    INSERT INTO
      ${tableName} (version, blob)
    VALUES
      ($1, $2)
    ON CONFLICT (version)
    DO
      UPDATE SET blob = EXCLUDED.blob
  `;
  const query = {
    text: sqlQuery,
    values: [version, data],
  };
  pgPool.query(query);
}

// Refreshes the Redis in-memory store to match persistent storage.
async function refresh() {
  const db = await fetch();
  if (db == null) {
    // Don't refresh on failure.
    return "No data to refresh";
  }
  return redisClient.set(tableName, db);
}

function allowCrossDomains(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if ('OPTIONS' == req.method) {
    res.sendStatus(200);
  }
  else {
    next();
  }
}

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(allowCrossDomains);
  

const router = express.Router();

router.get('/api', (req, res) => {
  res.send("alive");
});

router.post('/api/:action', async (request, response) => {
  switch (request.params.action) {
    case "refresh":
      response.json({
        message: await refresh(),
      });
      break;
    case "set":
      // Allow simple requests directly pushing the data.
      const payload = request.body;
      let data = payload;
      if (data.data) {
        data = data.data;
      }
      persist(data, payload.version);
      const blob = JSON.stringify(data);
      response.json({
        message: redisClient.set(tableName, blob)
      });
      break;
    case "get":
      redisClient.get(tableName, function (err, reply) {
        if (reply != null) {
          response.json(JSON.parse(reply));
        } else {
          response.json({
            message: err
          });
        }
      });
      break;
    case "infodb":
      const item = await pgPool.query('SELECT version()');
      response.json(item.rows[0]);
    case "infocache":
      redisClient.info(function (err, reply) {
        if (reply != null) {
          response.send(reply);
       } else {
          response.send({
            message: err,
          });
        }
      });
      break;
    case "flush":
      redisClient.flushdb(function (err, reply) {
        if (reply != null) {
          response.json({
            message: reply
          });
        } else {
          response.json({
            message: err
          });
        }
      });
      break;
    default:
      response.json({
        message: "Not defined"
      });
  }
});

(async () => {
  // Refresh the database before starting.
  await refresh();
  
  const port = Number(process.env.PORT || 5000);

  app.use("/", router);

  app.listen(port, function() {
    console.log("Listening on " + port);
  });

})();

