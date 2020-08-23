const get = (object, path) =>
  path.split('.').reduce((xs, x) => (xs != null && xs[x] != null) ? xs[x] : null, object)

export {
  get,
};  