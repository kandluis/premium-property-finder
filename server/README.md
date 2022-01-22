# The Backend Server

This code is used to deploy a server on heroku (see `../README.md`). In general, the server is used to cache results across requests using Redis + a permanent database.

## Development

When changing code, things get transpiled from Typescript to Javascript. Run the following command when you change code:

```
npm run postinstall
npm run start
```

## Frequently Encountered Issues

### Redis Add-On Is Deleted

If it's been a long time since you've used the app, it's possible the Redis database has been deleted. This will generally manifest itself as the error:

```
Error: Redis connection to BLAH failed - connect ENOENT redis://default:rYyZwEOaLPbPP8UfQT7zbf0P9m00copK@redis-18540.c15.us-east-1-2.ec2.cloud.redislabs.com:18540
```

Just re-install the add-on to get a brand new database.