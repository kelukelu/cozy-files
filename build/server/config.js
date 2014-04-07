// Generated by CoffeeScript 1.7.1
var americano, config, publicStatic, staticMiddleware;

americano = require('americano');

staticMiddleware = americano["static"](__dirname + '/../client/public', {
  maxAge: 86400000
});

publicStatic = function(req, res, next) {
  var url;
  url = req.url;
  req.url = req.url.replace('/public/assets', '');
  return staticMiddleware(req, res, function(err) {
    req.url = url;
    return next(err);
  });
};

config = {
  common: {
    set: {
      'view engine': 'jade',
      'views': './server/views'
    },
    use: [
      americano.bodyParser(), require('cozy-i18n-helper').middleware, americano.errorHandler({
        dumpExceptions: true,
        showStack: true
      }), staticMiddleware, publicStatic
    ]
  },
  development: [americano.logger('dev')],
  production: [americano.logger('short')],
  plugins: ['americano-cozy']
};

module.exports = config;
