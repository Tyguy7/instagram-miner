
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//local config
var config = require('./config')

app.get('/', routes.index);
app.get('/advanced', routes.advanced);

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

//socket.io
var io = require('socket.io')(server);

//miner modules
var Miner = require('./instagram/miner.js');
var miner = new Miner(config.clientId, io);

//handle socket events
io.on('connection', function(socket){

    console.log('client connected', socket.id);

    socket.on('startMining', function(hashtag){
        console.log('start mining '+hashtag);
        miner.mine(hashtag);
    });

    socket.on('compareUsers', function(users){
        console.log('compare some users');
        miner.compareUsers(users);
    });

    socket.on('compareHashtags', function(hashtags){
        console.log('compare some hashtags');
        miner.compareHashtags(hashtags);
    });

    socket.on('searchHashtagsWithDate', function(data){
        console.log('search hashtags with date range');
        miner.startOver(false);
        miner.searchHashtagsWithDate(data);
    });

    socket.on('startOver', function(users){
        console.log('start fresh');
        miner.startOver(true);
    });

});


