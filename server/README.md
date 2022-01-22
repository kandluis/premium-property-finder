# The Backend Server

This code is used to deploy a server on heroku (see `../README.md`). In general, the server is used to cache results across requests using Redis + a permanent database.

## Development

When changing code, things get transpiled from Typescript to Javascript. Run the following command when you change code:

```
npm run postinstall
npm run start
```

## Current Routes

The server has several routes.

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

### Redis Add-On Is Deleted

If it's been a long time since you've used the app, it's possible the Redis database has been deleted. This will generally manifest itself as the error:

```
Error: Redis connection to BLAH failed - connect ENOENT redis://default:rYyZwEOaLPbPP8UfQT7zbf0P9m00copK@redis-18540.c15.us-east-1-2.ec2.cloud.redislabs.com:18540
```

Just re-install the add-on to get a brand new database.