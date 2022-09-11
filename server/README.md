# The Backend Server

This code is used to deploy a server on heroku (see `../README.md`). In general, the server is used to cache results across requests using Redis + a permanent database.

# Development

When changing code, things get transpiled from Typescript to Javascript. Run the following command when you change code:

```sh
npm run postinstall
npm run start
```

If this is a fresh pull, you'll also need to add the following into `.env`:

```sh
# The URL for the Redis database to use as cache.
REDISCLOUD_URL=<TODO>
# THe URL for the postgres database to connect.
DATABASE_URL=<TODO>
# The SECRET must match the front-end. If LOCAL_DEBUG is not set, this secret
# blocks all requests.
SECRET=<TODO>
# Enables get/ requests on most routes, disables secret verification.
LOCAL_DEBUG=1
```

Note that it's impossible to lookup these values in fly.io, so if you've lost them, you probaby want to set-up new databases. The app should work fine with a fresh setup.

# Deploying to fly.io

The backend server is used on fly.io. You should have a [postgres](https://fly.io/docs/reference/postgres-whats-next/) database attached to this app, as well as a redis global databse. 

You'll need these values for `DATABASE_URL` and `REDISCLOUD_URL`. 

## First Deployment 

If this is the first time setting up the app on fly.io. the `flyctl launch` command help in setting up the postgres database.

```sh
flyctl launch
```

To setup redis for the first time, follow the instructions [here](https://fly.io/docs/reference/redis/) to get access to a managed global redis instance.

You'll need to setup several secrets with the application. They roughtly map to the secrets in your `.env` file. The `DATABASE_URL` will have already been set for you if you set postgres along with the app.

```sh
flyctl secrets set DATABASE_URL=... REDISCLOUD_URL=... SECRET=... 
```

## Subsequent Deployments

You'll need to have `WireGuard` setup and an active connection to your fly.io organization. [This article](https://fly.io/docs/reference/private-networking/) walks you through a step-by-step process to enable this. If done correctly, you can connect to the production back-ends w/o making any changes to the `.env` variables.


Then simply run:

```sh
flyclt deploy
```

## Current Routes

The server has several routes. Note that `/api` also accepts `GET` requests wihtout requiring a `SECRET` when `LOCAL_DEBUG=1`.

- `/api` [GET] - This is a heartbeat endpoint.
- `/proxy/<URL>` [GET, POST] - This removes CORS headers by forwarding incoming messages. This enables us to scrape requests from domains we don't own.
- `/api/<ACTION>` [POST] - Main APIs, by default POST requests. Actions include:
  - refresh: Refreshes the Redis in-memory store to match persistent storage.
  - set: Allow simple requests directly pushing the data.
  - get: Retrieve stored data.
  - infodb: Gets persistent storage version.
  - infocache: Gets redis cache info.
  - flush: Flushes the redisc client.


## Frequently Encountered Issues

### [DEPRECATED] Redis Add-On Is Deleted

If it's been a long time since you've used the app, it's possible the Redis database has been deleted. This will generally manifest itself as the error:

```
Error: Redis connection to BLAH failed - connect ENOENT redis://default:rYyZwEOaLPbPP8UfQT7zbf0P9m00copK@redis-18540.c15.us-east-1-2.ec2.cloud.redislabs.com:18540
```

Just re-install the add-on to get a brand new database.