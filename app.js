/*jslint browser: true, devel: true, node: true, debug: true, todo: true, indent: 2, maxlen: 150, unparam: true*/
/*global require, module, mode*/

(function () {
  'use strict';

  /**
   *---------------------------------------------------------
   * app.js
   *---------------------------------------------------------
   *
   * Sample Web Application implemented in NodeJS.
   *
   * Illustrates what a Developer typically needs to do to
   * use AT&T WebRTC JS SDK to add Telephony and add real-time
   * Call and Conference Management functions into a Web
   * Application.
   *
   *----------------
   * Pre-requisites:
   *----------------
   * Before starting work on your Web Application, it is assumed
   * that, you previously:
   *
   * a) Created an app on AT&T Developer Portal with:
   *
   * WEBRTCMOBILE scope ( 'AT&T Mobile Number' feature)
   * and/or
   * WEBRTC scope ( 'Virtual Number' and 'Account ID' features)
   *
   * b) Configured the resulting App Key, App Secret, Virtual
   * numbers etc. in the package.json
   *
   *
   *-----------------------------
   * This Sample App illustrates:
   *-----------------------------
   *
   *---------------------------------------------
   * 1) Setting up /oauth routes in your web-tier
   *---------------------------------------------
   * to handle User Consent if your application's
   * end user is an AT&T Mobility Subscriber. (aka 'AT&T
   * Mobile Number') feature
   *
   * NOTE:
   *------
   * This set up is needed ONLY IF you plan to use 'AT&T
   * Mobile Number' feature in your Web Application. You
   * can skip it if you plan to use only 'Virtual Number' and
   * 'Account ID' features.
   *
   * Following 2 routes are set up:
   * a) /oauth/authorize
   * b) /oauth/callback
   * c) /oauth/token
   * d) /e911id
   *
   * You can use the file ./routes/att.js as-is out-of-the-box.
   *
   *---------------------------------------------------------
   * @author Raj Sesetti, AT&T Developer Program, DRT/LTA
   *---------------------------------------------------------
   */

// ---------------------------------------------
// Boiler-plate Express App 'require' statements
// ---------------------------------------------
//
  var express = require('express'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    favicon = require('static-favicon'),
    bodyParser = require('body-parser'),
// ---------------------------------------------
// END: Boiler-plate 'require' statements
// ---------------------------------------------

    app,
    pkg,
    att,
    http_port,
    https_port,
    cors_domains,
    cert_file,
    key_file,
    privateKey,
    certificate,
    api_env,
    app_key,
    app_secret,
    oauth_callback,
    virtual_numbers_pool,
    ewebrtc_domain,
    env_config,
    is_heroku_env;

//--------------------------------------------------------
// SECTION: Initialize configuration
//--------------------------------------------------------
// Following are calculated after required configuration
// entries are read or defaulted.
//
//--------------------------------------------------------
  pkg = require('./package.json');

  is_heroku_env = process.env.NODE_HOME && process.env.NODE_HOME.indexOf('heroku') !== -1;

  if (is_heroku_env) {

    http_port = process.env.PORT;
    console.info('Using HTTP PORT ', http_port);

  } else {

    http_port = process.env.HTTP_PORT || pkg.http_port;
    console.info('Using HTTP PORT ', http_port);

    https_port = process.env.HTTPS_PORT || pkg.https_port;
    console.info('Using HTTPS PORT ', https_port);

  }

  cors_domains = process.env.CORS_DOMAINS || pkg.cors_domains;
  console.info('Domains to add in CORS Headers: ', cors_domains);

  cert_file = process.env.CERT_FILE || pkg.cert_file;
  key_file = process.env.KEY_FILE || pkg.key_file;
  console.info('Using SSL Configuration - Certificate: ', cert_file, 'Key File: ', key_file);

  api_env = process.argv[2] || process.env.API_ENV || pkg.default_api_env;
  console.info('Using API Env : ', api_env);

  env_config = pkg[api_env];
  env_config.api_env = api_env;

  app_key = env_config.app_key;
  app_secret = env_config.app_secret;
  oauth_callback = env_config.oauth_callback;
  virtual_numbers_pool = env_config.virtual_numbers_pool;
  ewebrtc_domain = env_config.ewebrtc_domain;

  if (!app_key || !app_secret) {
    console.error('Insufficient App Configuration');
    console.error('Entries app_key, app_secret are mandatory');
    console.error('Exiting...');
    process.exit(1);
  }

  if ('YourAppKey' === app_key || 'YourAppSecret' === app_secret) {
    console.error('Invalid app_key or app_secret');
    console.error('Entries app_key or app_secret are not set');
    console.error('Exiting...');
    process.exit(1);
  }

  console.info('#####################################################');
  console.info('        Using App Key: ', app_key);
  console.info('     Using App Secret: ', app_secret);
  console.info('#####################################################');

  if (oauth_callback) {
    console.info('OAuth Callback URL: ', oauth_callback);
  } else {
    console.info('OAuth callback is NOT configured. You can not use mobile numbers');
  }
  console.info('#####################################################');

  if (virtual_numbers_pool) {
    console.info('Using Virtual Number Pool:');
    console.info(virtual_numbers_pool);
  } else {
    console.info('Virtual numbers pool is NOT configured. You can not user virtual numbers');
  }
  console.info('#####################################################');

  if (ewebrtc_domain) {
    console.info('EWebRTC domain:');
    console.info(ewebrtc_domain);
  } else {
    console.info('EWebRTC domain is NOT configured.');
  }
  console.info('#####################################################');

//--------------------------------------------------------
// END SECTION: Initialize configuration
//--------------------------------------------------------


//--------------------------------------------------------
// SECTION: start of action
//--------------------------------------------------------
// Configuration is all ready. We are good to go.
//
//--------------------------------------------------------

// Handle this process just in case...
// so that the Log strems are not corrupted
//
  process.on('SIGUSR2', function () {
    console.info('Signal SIGUSR2 received. Reopening log streams...');
  });

// ---------------------------------------------
// BEGIN: Boiler-plate Express app set-up
// ---------------------------------------------
//
  /*jslint stupid: true*/
  privateKey = fs.readFileSync('sample.key', 'utf8');
  certificate = fs.readFileSync('sample.cert', 'utf8');
  /*jslint stupid: false*/

  app = express();

//View Engine setup

  /*jslint nomen: true*/
  app.set('views', __dirname + '/views');
  app.set('view engine', 'hjs');
  /*jslint nomen: false*/

// Middleware

  /*jslint nomen: true*/
  app.use(favicon());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: false}));
  app.use('/', express.static(__dirname + '/public'));
  /*jslint nomen: false*/

// ---------------------------------------------
// END: Boiler-plate Express app set-up
// ---------------------------------------------

// ---------------------------------------------
// BEGIN: CUSTOM CODE for WebRTC functionality
// ---------------------------------------------
// This is the meat of code to enable AT&T WebRTC
//
// ---------------------------------------------
// CUSTOM CODE to enable 'AT&T Mobile Number'
// ---------------------------------------------
// OAuth Routes need for AT&T Authorization if
// you are planning for AT&T Mobility Subscribers
// to use your App. This is also known as
// 'AT&T Mobile Number' feature of AT&T Enhanced WebRTC API
//
// You don't need to include the following 5 lines
// if you don't use that feature
//
  att = require('./routes/att');

  att.initialize(env_config, app);

// ---------------------------------------------
// END: CUSTOM CODE for 'AT&T Mobile Number'
// ---------------------------------------------

// ---------------------------------------------
// BEGIN: Boiler-plate Express app route set-up
// ---------------------------------------------
// Business as usual from below
//
// catch 404 and forward to error handler
//
  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

// DEV error handler
// No stacktraces shown to end user.
//
  if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    });
  }

// PROD error handler
// No stacktraces shown to end user.
//
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: {}
    });
  });

//
// Create web servers - HTTP and HTTPS
//

  var server = http.createServer(app);
  var io = require('socket.io').listen(server);
  server.listen(http_port);

  io.on('connection', function(socket) {
    console.log('a user connected');

    socket.on('join', function(room) {
      socket.join(room);
      console.log('joining '+room);
    });

    socket.on('leave', function(room) {
      socket.leave(room);
      console.log('leaving '+room);
    });

    socket.on('update', function(msg) {
      socket.broadcast.to(msg.room).emit(msg.event, msg);

      console.log('sending room "'+msg.room+'" message: '+JSON.stringify(msg));
    });    
  });  

  

  console.log('HTTP web server listening on port ' + http_port);

  if (!is_heroku_env) {
    https.createServer({
      key: privateKey,
      cert: certificate
    }, app).listen(https_port);
    console.log('HTTPS web server listening on port ' + https_port);
  }

// ---------------------------------------------
// END: Boiler-plate Express app route set-up
// ---------------------------------------------

//-----------------------------------------------------------
// END: app.js
//-----------------------------------------------------------

}());