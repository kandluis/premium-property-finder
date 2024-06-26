import asyncHandler from 'express-async-handler';
import bodyParser from 'body-parser';
import { createServer } from 'cors-anywhere';
import express from 'express';
import getPort from 'get-port';
import pg from 'pg';
import { createClient } from 'redis';
import 'dotenv/config';

type StoredData = {
  [zpid: number]: {
    [propName: string]: string
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

// 'fn' is only run in debug mode. In production, we return false.
function DEBUG_ONLY<Args, Return>(
  fn: (...args: Args[]) => Return,
): (...args: Args[]) => Return | boolean {
  function wrapper(...args: Args[]): Return | boolean {
    if (process.env.NODE_ENV !== 'production') {
      return fn(...args);
    }
    return false;
  }
  return wrapper;
}
// 'fn' is only run in production mode. In debug, we return false.
function PROD_ONLY<Args, Return, Default>(
  fn: (...args: Args[]) => Return,
  val: Default
): (...args: Args[]) => Return | Default {
  function wrapper(...args: Args[]): Return | Default {
    if (process.env.NODE_ENV === 'production') {
      return fn(...args);
    }
    return val;
  }
  return wrapper;
}

const tableName = 'properties';
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

if (!process.env.REDISCLOUD_URL) {
  throw Error('Need to define REDISCLOUD_URL in .env file.');
}
const redisClient = createClient({
  url: process.env.REDISCLOUD_URL,
  socket: {
    family: 6,
  },
});
redisClient.on('error', DEBUG_ONLY((err) => console.log(err)));
redisClient.on('ready', DEBUG_ONLY((_) => console.log('redis is ready !')));
redisClient.on('connect', DEBUG_ONLY((_) => console.log('connect redis success !')));
await redisClient.connect();

/**
  Handle shutdown of server gracefully by closing all connections to backends.
*/
async function end(): Promise<void> {
  try {
    await pgPool.end();
    await redisClient.quit();
  } catch (err) {
    console.log(`Error closing connection: ${err as string}`);
  }
}
process.once('SIGTERM', () => {
  end().finally(() => process.exit(0));
});
process.once('SIGINT', () => {
  end().finally(() => process.exit(0));
});

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
async function refresh(): Promise<string | null> {
  const db = await fetch();
  if (db == null) {
    // Don't refresh on failure.
    return null;
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
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT');
  res.header('Access-Control-Allow-Headers', 'Api-Key, Authorization, Content-Type, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else if (PROD_ONLY(() => req.header('Api-Key') !== process.env.SECRET, false)()) {
    res.sendStatus(403);
  } else {
    next();
  }
}

// Set-up proxy router.
const corsProxyServer = createServer({
  requireHeader: PROD_ONLY(() => ['origin', 'x-requested-with'], [])(),
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
});

let inCache: string | null = null;

const app = express()
  .use(bodyParser.json({ limit: '50mb' }))
  .use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  .use(allowCrossDomains);

const router = express.Router()
  .get('/proxy/:proxyUrl*', (req, res) => {
    req.url = req.url.replace('/proxy/', '/');
    corsProxyServer.emit('request', req, res);
  })
  .post('/proxy/:proxyUrl*', (req, res) => {
    req.url = req.url.replace('/proxy/', '/');
    corsProxyServer.emit('request', req, res);
  })
  .put('/proxy/:proxyUrl*', (req, res) => {
    req.url = req.url.replace('/proxy/', '/');
    corsProxyServer.emit('request', req, res);
  })
  .get('/api', (req, res) => {
    res.send('alive');
  })
  .all('/api/:action', asyncHandler(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'POST') {
      response.sendStatus(403);
    }
    if (PROD_ONLY(() => request.method === 'GET', false)()) {
      response.sendStatus(404);
    }
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
        inCache = await redisClient.set(tableName, blob);
        response.json({
          message: inCache,
        });
        break;
      }
      case 'get': {
        if (inCache) {
          try {
            const reply = await redisClient.get(tableName);
            if (!reply) {
              response.json({
                message: `Null reply from redis for table: ${tableName}`,
              });
            } else {
              response.json(JSON.parse(reply));
            }
          } catch (err) {
            response.json({
              message: err,
            });
          }
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
        try {
          const reply = await redisClient.info();
          response.send(reply);
        } catch (err) {
          response.send({
            message: err,
          });
        }
        break;
      }
      case 'flush': {
        try {
          const reply = await redisClient.flushDb();
          response.json({
            message: reply,
          });
        } catch (err) {
          response.json({
            message: err,
          });
        }
        break;
      }
      default: {
        response.json({
          message: 'Not defined',
        });
      }
    }
  }));

(async () => {
  // Refresh the database before starting.
  console.log('Starting up...');
  await refresh();

  console.log('Getting server port...');
  const port = await getPort({
    port: Number(process.env.PORT) || 5000,
  });

  // Back-end server.
  app.use('/', router)
    .listen(port, () => {
      console.log(`Listening on ${port}`);
    });
})()
  .then(null)
  .catch(null);
