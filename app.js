//. app.js

var express = require( 'express' ),
    // eslint-disable-next-line no-unused-vars
    ejs = require( 'ejs' ),
    passport = require( 'passport' ),
    request = require( 'request' ),
    session = require( 'express-session' ),
    WebAppStrategy = require( 'ibmcloud-appid' ).WebAppStrategy,
    app = express();

var settings = require( './settings' );

//. env values
var settings_region = 'REGION' in process.env ? process.env.REGION : settings.region;
var settings_tenantId = 'TENANT_ID' in process.env ? process.env.TENANT_ID : settings.tenantId;
var settings_apiKey = 'APIKEY' in process.env ? process.env.APIKEY : settings.apiKey;
var settings_secret = 'SECRET' in process.env ? process.env.SECRET : settings.secret;
var settings_clientId = 'CLIENT_ID' in process.env ? process.env.CLIENT_ID : settings.clientId;
var settings_redirectUri = 'REDIRECT_URI' in process.env ? process.env.REDIRECT_URI : settings.redirectUri;
var settings_oauthServerUrl = 'https://' + settings_region + '.appid.cloud.ibm.com/oauth/v4/' + settings_tenantId;

//. setup session
app.use( session({
  secret: 'appid_icon',
  resave: false,
  cookie: { maxAge: ( 365 * 24 * 60 * 60 * 1000 ) },
  saveUninitialized: false
}));

//. setup passport
app.use( passport.initialize() );
app.use( passport.session() );
passport.serializeUser( ( user, cb ) => cb( null, user ) );
passport.deserializeUser( ( user, cb ) => cb( null, user ) );
passport.use( new WebAppStrategy({
  tenantId: settings_tenantId,
  clientId: settings_clientId,
  secret: settings_secret,
  oauthServerUrl: settings_oauthServerUrl,
  redirectUri: settings_redirectUri
}));

//. enable routing
app.use( express.Router() );
// eslint-disable-next-line no-undef
app.use( express.static( __dirname + '/public' ) );

//. template engine
// eslint-disable-next-line no-undef
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

//. login
app.get( '/appid/login', passport.authenticate( WebAppStrategy.STRATEGY_NAME, {
  successRedirect: '/',
  forceLogin: false //true
}));

//. callback
app.get( '/appid/callback', function( req, res, next ){
  next();
}, passport.authenticate( WebAppStrategy.STRATEGY_NAME )
);

//. logout
app.get( '/appid/logout', function( req, res ){
  WebAppStrategy.logout( req );
  req.user = null;
  res.redirect( '/' );
});

//. access restriction
app.all( '/*', function( req, res, next ){
  if( !req.user || !req.user.sub ){
    res.redirect( '/appid/login' );
  }else{
    next();
  }
});


//. top page
app.get( '/', function( req, res ){
  if( !req.user.access_token ){
    getAccessToken().then( function( access_token ){
      req.user.access_token = access_token;
      getProfile( access_token, req.user.sub ).then( function( profile ){
        if( profile ){
          req.user.id = profile.id;
          req.user.attributes = JSON.parse( JSON.stringify( profile.attributes ) );
        }
        res.render( 'index', { profile: req.user } );
      }).catch( function( err2 ){
        res.render( 'index', { profile: req.user } );
      });
    }).catch( function( err1 ){
      res.render( 'index', { profile: req.user } );
    });
  }else{
    res.render( 'index', { profile: req.user } );
  }
});

async function getAccessToken(){
  return new Promise( async ( resolve, reject ) => {
    //. GET an IAM token
    //. https://cloud.ibm.com/docs/appid?topic=appid-manging-api&locale=ja
    var headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    };
    var option = {
      url: 'https://iam.cloud.ibm.com/oidc/token',
      method: 'POST',
      body: 'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=' + settings.apiKey,
      headers: headers
    };
    request( option, ( err, res, body ) => {
      if( err ){
        console.log( err );
        reject( null );
      }else{
        body = JSON.parse( body );
        var access_token = body.access_token;
        resolve( access_token );
      }
    });
  });
}

async function getProfile( access_token, user_id ){
  return new Promise( async ( resolve, reject ) => {
    if( access_token ){
      var headers1 = {
        accept: 'application/json',
        authorization: 'Bearer ' + access_token
      };
      var option1 = {
        url: 'https://' + settings.region + '.appid.cloud.ibm.com/management/v4/' + settings.tenantId + '/users/' + user_id + '/profile',
        method: 'GET',
        headers: headers1
      };
      request( option1, ( err1, res1, body1 ) => {
        if( err1 ){
          console.log( 'err1', err1 );
          reject( err1 );
        }else{
          var profile = JSON.parse( body1 );
          //console.log( JSON.stringify( profile, null, 2 ) );
          resolve( profile );
        }
      });
    }else{
      reject( 'no access token' );
    }
  });
}



//. listening to port
// eslint-disable-next-line no-undef
var port = process.env.PORT || 8080;
app.listen( port );
console.log( "server starting on " + port + " ..." );

