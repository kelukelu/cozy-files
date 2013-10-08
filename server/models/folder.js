// Generated by CoffeeScript 1.6.2
var Folder, americano;

americano = require('americano-cozy');

module.exports = Folder = americano.getModel('Folder', {
  path: String,
  name: String,
  slug: String
});

Folder.all = function(params, callback) {
  return Folder.request("all", params, callback);
};

Folder.byFolder = function(params, callback) {
  return Folder.request("byFolder", params, callback);
};