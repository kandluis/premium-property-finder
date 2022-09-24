# Development
Run
```sh
npm install
```

This should install all the required dependencies. If this is a fresh pull from the directory, you'll also need to provide a few keys. At the top-level (eg, same location as `package.json`), add a file called `.env` which defines the following environment variables:

```sh
REACT_APP_MAPQUEST_API_KEY=<TODO>
REACT_APP_ZILLOW_API_KEY=<TODO>
REACT_APP_SECRET=<TODO>
REACT_APP_CUTTLY=<TODO>
```
where each of the above correspond to your keys.

Then simply run:

```sh
npm start
```

To get started. See the `package.json` file for other available types.

# Connecting to Localhost if running back-end locally

Update the constants in `src/constants.tsx` to match the location of your backend. For details on launching the backend, see `server/README.md`.

# Publishing on GH-Pages

We've now configured it so that the gh-pages get published on every push to master.

If you'd like to publish without pushing, you can run the following commands:

```sh
npm run deploy
```


# Author

Luis Perez & Belinda Zeng