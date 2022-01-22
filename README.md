# Development
Run
```
npm install
```

This should install all the required dependencies. If this is a fresh pull from the directory, you'll also need to provide a few keys. At the top-level (eg, same location as `package.json`), add a file called `.env` which defines the following environment variables:

```
REACT_APP_MAPQUEST_API_KEY=<TODO>
REACT_APP_ZILLOW_API_KEY=<TODO>
REACT_APP_SECRET=<TODO>
REACT_APP_CUTTLY=<TODO>
```
where each of the above correspond to your keys.

Then simply run:

```
npm start
```

To get started. See the `package.json` file for other available types.

# Connecting to Localhost if running back-end locally

Update the constants in `src/constants.tsx` to match the location of your backend.

# Publishing on GH-Pages

Run the following commands:

```
npm run build
npm run push-gh-pages
```

# Heroku Set-up
Make sure you install the heroku CLI. You can add the remote branch to git using:
```
git remote add heroku https://git.heroku.com/property-server.git
```

If this is a fresh pull, you'll also need to add the following into `server/.env`:

```
REDISCLOUD_URL=<TODO>
DATABASE_URL=<TODO>
SECRET=<TODO>
```

YOu can get the production values of these variables by running:
```sh
heroku config:get REDISCLOUD_URL
heroku config:get DATABASE_URL
heroku config:get SECRET
```

Generally, these should point to whatever version of the database you want to use.

Then you can run, from `server/`:
```sh
npm run start
````

# Deploying Back-end server
```
npm run deploy-server
```

# Author

Luis Perez & Belinda Zeng