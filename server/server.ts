import bodyParser from 'body-parser';
// @ts-ignore
import {createServer} from 'cors-anywhere';
import express from 'express';
import pg from 'pg';
import redis from 'redis';
import url from 'url';
import 'dotenv/config';

type StoredData = {
  [zpid: number]: {
    [propName: string]: any
  }
}
type Row = {
  version: number,
  blob: StoredData,
}
type SetOperationBody = StoredData & {
  version?: number,
  data?: StoredData,
}

const tableName = 'properties';
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

if (!process.env.REDISCLOUD_URL) {
  throw Error('Need to define REDISCLOUD_URL in .env file.');
}
const redisURL = url.parse(process.env.REDISCLOUD_URL);
if (!redisURL.hostname) {
  throw Error(`Invalid redis url: ${redisURL.query || ''}`);
}
const redisClient = redis.createClient(
  Number(redisURL.port),
  redisURL.hostname || '',
  { no_ready_check: true },
);
if (redisURL.auth) {
  redisClient.auth(redisURL.auth.split(':')[1]);
}

/**
  Handle shutdown of server gracefully by closing all connections to backends.
*/
function end(): void {
  pgPool.end()
    .then(() => {
      redisClient.end(true);
      process.exit(0);
    })
    .catch(() => process.exit(0));
}
process.once('SIGTERM', end);
process.once('SIGINT', end);

/**
Fetches properties from persistence storage in string format.

@returns: The JSON object of properties as a JSON string, if any.
*/
async function fetch(): Promise<string | null> {
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
  if (res.rows.length === 0) {
    return null;
  }
  return JSON.stringify((res.rows[0] as Row).blob);
}

/**
 Persists the given data at the specified version in storage.

 @param data - The JSON object to persist into storage.
 @param version - If provided, the version of the data to persist.
*/
async function persist(data: StoredData, version: number | undefined | null) : Promise<void> {
  let definedVersion = 0;
  if (typeof (version) !== 'undefined' && version != null) {
    definedVersion = version;
  } else {
    const resp = await pgPool.query({
      text: `SELECT MAX(version) FROM ${tableName} LIMIT 1`,
    });
    const resultVersion = (resp.rows[0] as Row).version;
    if (typeof (resultVersion) !== 'undefined' && resultVersion != null) {
      definedVersion = resultVersion;
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
    values: [definedVersion, data],
  };
  await pgPool.query(query);
}

/**
  Refreshes the Redis in-memory store to match persistent storage.

  @returns - Whether or not the refresh operation succeeded.
*/
async function refresh(): Promise<boolean> {
  const db = await fetch();
  if (db == null) {
    // Don't refresh on failure.
    return false;
  }
  return redisClient.set(tableName, db);
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
function allowCrossDomains(
  req: express.Request, res: express.Response, next: express.NextFunction,
): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Api-Key');

  // intercept OPTIONS method
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else if (req.header('Api-Key') !== process.env.SECRET) {
    res.sendStatus(403);
  } else {
    next();
  }
}

// Set-up proxy router.
const cors_proxy = createServer({
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
    xfwd: false,
  },
})


let inCache = false;

const app = express()
  .use(bodyParser.json({limit: '50mb'}))
  .use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  .use(allowCrossDomains);

const router = express.Router()
  .get('/proxy/:proxyUrl*', (req, res) => {
    req.url = req.url.replace('/proxy/', '/');
    cors_proxy.emit('request', req, res);
  })
  .post('/proxy/:proxyUrl*', (req, res) => {
    req.url = req.url.replace('/proxy/', '/');
    cors_proxy.emit('request', req, res);
  })
  .get('/api', (req, res) => {
    res.send('alive');
  })
  .post('/api/:action', async (request, response) => {
    switch (request.params.action) {
      case 'refresh': {
        response.json({
          message: await refresh(),
        });
        break;
      }
      case 'set': {
        // Allow simple requests directly pushing the data.
        const payload = request.body as SetOperationBody;
        let data = payload;
        if (data.data) {
          data = data.data;
        }
        persist(data, payload.version)
          .then(null)
          .catch(null);
        const blob = JSON.stringify(data);
        inCache = redisClient.set(tableName, blob)
        response.json({
          message: inCache,
        });
        break;
      }
      case 'get': {
        if (inCache) {
          redisClient.get(tableName, (err, reply) => {
            if (reply != null) {
              response.json(JSON.parse(reply));
            } else {
              response.json({
                message: err,
              });
            }
          });
        } else {
          const data = await fetch();
          if (data === null) {
            response.json({});
          } else {
            response.json(JSON.parse(data));
          }
        }
        break;
      }
      case 'infodb': {
        const item = await pgPool.query('SELECT version()');
        response.json(item.rows[0]);
        break;
      }
      case 'infocache': {
        redisClient.info((err, reply) => {
          if (reply != null) {
            response.send(reply);
          } else {
            response.send({
              message: err,
            });
          }
        });
        break;
      }
      case 'flush': {
        redisClient.flushdb((err, reply) => {
          if (reply != null) {
            response.json({
              message: reply,
            });
          } else {
            response.json({
              message: err,
            });
          }
        });
        break;
      }
      default: {
        response.json({
          message: 'Not defined',
        });
      }
    }
  });



(async () => {
  // Refresh the database before starting.
  await refresh();

  const port = Number(process.env.PORT || 5000);

  // Back-end server. 
  app.use('/', router)
     .listen(port, () => {
      console.log(`Listening on ${port}`);
    });
})()
  .then(null)
  .catch(null);
