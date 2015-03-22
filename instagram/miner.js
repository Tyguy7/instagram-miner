var async = require('async');
var request = require('request');
var Instagram = require('./instagram');
var instagram = new Instagram(request, async);
var json2csv = require('json2csv');
var fs = require('fs');
var redis = require("redis");
var client = redis.createClient();
client.on("error", function (err) {
    console.log("Redis Error " + err);
});
client.select(3, function() {
    console.log('connected to redis DB #3');
});

module.exports = function Miner(io){

    return {

        mine: function(hashtag){

            io.emit('newTask', {name: hashtag, posts: 0, status: 'starting'});

            instagram.getRecentMediaByTag(hashtag, 250, function(media){

                io.emit('updateTask', {name: hashtag, posts: media.length, status: 'running'});

                async.eachSeries(media, function( item, callback) {

                    //store user's use of each hashtag
                    var hashtagUpdates = [];
                    var userUpdates = [];
                    async.eachSeries(item.tags, function( tag, callback) {

                        client.zrange('hashtag-'+tag, 0, -1, 'withscores', function(err, value){
                            if(err || !value || value.length < 1){
                                //console.log('new hashtag '+tag);
                                io.emit('newHashtag', {name: tag});
                            } else {
                                //console.log('update hashtag '+tag);
                                hashtagUpdates.push({name:tag, occurrences: (value.length/2)+1});
                            }
                            client.zincrby('hashtag-'+tag, 1, item.user.username);
                            client.zincrby('user-hashtags-'+item.user.username, 1, tag, function(){
                                client.zrange('user-hashtags-'+item.user.username, 0, -1, 'withscores', function(err, value){
                                    if(err){
                                        console.log('yikes, couldnt pull user hashtags list '+item.user.username);
                                    } else {
                                        userUpdates.push({username: item.user.username, hashtags: (value.length/2)});
                                    }
                                    callback();
                                });
                            });
                        });
                    }, function(err){
                        if( err ) {
                            console.log('Error!!!!');
                        } else {
                            if(hashtagUpdates.length>0){
                                //console.log('update hashtags to client');
                                io.emit('updateHashtags', hashtagUpdates);
                            }
                            if(userUpdates.length>0){
                                //console.log('update users to client');
                                io.emit('updateUsers', userUpdates);
                            }
                        }
                    });
                    
                    //store independant record of user
                    client.get('user-'+item.user.username, function(err, value){
                        if(err){
                            console.log('error when attempting to get '+item.user.username);
                        }
                        if(!value){
                            client.set('user-'+item.user.username, JSON.stringify(item.user) );
                            io.emit('newUser', item.user);
                        }
                    });
                    callback();
                }, function(err){
                    if( err ) {
                        console.log('\nA media item failed to process\n');
                        io.emit('updateTask', {status: 'error'});
                    }
                });
            }, function(err, total){
                if(err){
                    io.emit('updateTask', {name:hashtag, status: 'error'});
                    console.log(err);
                } else {
                    io.emit('updateTask', {name:hashtag, status: 'finished'});
                    console.log('all done, stored info from '+total+' posts');
                }
            });
        },

        compareUsers: function(users){

            var results = {users:[],sharedHashtags:[]};
            async.eachSeries(users, function( user, callback) {

                client.get('user-'+user, function(err, userData){
                    if(err || !userData){
                        console.log('error when attempting to compare '+user);
                    }
                    userData = JSON.parse(userData); 
                    client.zrange('user-hashtags-'+user, 0, -1, function(err, hashtags){
                        if(err){
                            callback('yikes, couldnt pull user hashtags list '+user);
                        } else {
                            userData.hashtags = hashtags;
                        }
                        results.users.push(userData);
                        callback();
                    }); 
                });

            }, function(err){
                if(err){
                    return console.log(err);
                }
                var intersection = [];
                results.users.forEach(function(user, idx){
                    if(idx==0){
                        intersection = results.users[idx].hashtags;
                    } else {
                        var result;
                        result = results.users[idx].hashtags.filter(function(n) {
                            return intersection.indexOf(n) != -1
                        });
                        intersection = result;
                    }
                });
                results.sharedHashtags = intersection;
                io.emit('comparedUsers', results);
            });
        },

        compareHashtags: function(hashtags){

            var results = {hashtags:[],sharedUsers:[]};
            async.eachSeries(hashtags, function( hashtag, callback) {

                client.zrange('hashtag-'+hashtag, 0, -1, function(err, users){
                    if(err || !users){
                        console.log('error when attempting to compare '+hashtag);
                    }
                    results.hashtags.push({name:hashtag,users:users});
                    callback();
                });

            }, function(err){
                if(err){
                    return console.log(err);
                }
                var intersection = [];
                results.hashtags.forEach(function(hashtag, idx){
                    if(idx==0){
                        intersection = results.hashtags[idx].users;
                    } else {
                        var result;
                        result = results.hashtags[idx].users.filter(function(n) {
                            return intersection.indexOf(n) != -1
                        });
                        intersection = result;
                    }
                });
                results.sharedUsers = intersection;
                io.emit('comparedHashtags', results);
            });
        },

        searchHashtagsWithDate: function(data){

            if(!data.startDate || !data.endDate || data.startDate==data.endDate || data.hashtags.length < 1){
                io.emit('badData', data);
                return;
            }

            var bounce = false;

            instagram.searchHashtagsWithDate(data.hashtags, data.startDate, data.endDate, function(update){

                //debounce this 1s
                if(!bounce || update.status=='idle'){
                    io.emit('searchHashtagsWithDateUpdate', update);
                    bounce = true;
                    setTimeout(function(){
                        bounce = false;
                    }, 1000);
                }
            }, function(err, results){

                if(err){
                    throw new Error(err);
                }

                data.hashtags.forEach(function(hashtag){
                    client.sadd('hashtags', hashtag, function(err, value){
                        if(err) {
                            callback(err);
                        }
                    });
                });

                //create a CSV to download, and also send the first 50 rows
                async.eachSeries(results, function( item, callback) {

                    //store counts of each user's use of hashtag
                    //console.log('storing in redis', item.id);
                    async.parallel([
                        function(callback){
                            client.zincrby('hashtag-'+item.hitHashtag, 1, item.user.username, function(err, value){
                                if(err) {
                                    callback(err);
                                }
                                callback();
                            });
                        },
                        function(callback){
                            client.incrby('user-likes-'+item.user.username, item.likes.count, function(err, value){
                                if(err) {
                                    callback(err);
                                }
                                callback();
                            });
                        },
                        function(callback){
                            client.incrby('user-comments-'+item.user.username, item.comments.count, function(err, value){
                                if(err) {
                                    callback(err);
                                }
                                callback();
                            });
                        },
                        function(callback){
                            client.incrby('user-posts-'+item.user.username, 1, function(err, value){
                                if(err) {
                                    callback(err);
                                }
                                callback();
                            });
                        },
                        function(callback){
                            client.sadd('users', item.user.username, function(err, value){
                                if(err) {
                                    callback(err);
                                }
                                callback();
                            });
                        },
                        function(callback){
                            client.set('user-'+item.user.username, JSON.stringify(item.user), function(err, value){
                                if(err) {
                                    callback(err);
                                }
                                callback();
                            });
                        }],
                    function(err, results){
                        if(err) {
                            callback(err);
                        }
                        //console.log('COMPLETE', item.id);
                        callback();
                    });

                }, function(err){
                    if( err ) {
                        throw new Error(err);
                        io.emit('searchHashtagsWithDateUpdate', {status: 'error', msg: err});
                    }
                    //collect data and create CSV and preview
                    var bigData = [];

                    client.smembers('users', function(err, users){
                        if(err) {
                            throw new Error(err);
                        }
                        async.each(users, function( user, callback) {
                            var row = {username: user};
                            bigData.push(row);
                            client.smembers('hashtags', function(err, hashtags){
                                if(err) {
                                    throw new Error(err);
                                }
                                hashtags.forEach(function(hashtag){
                                    row[hashtag] = 0;
                                });
                                async.eachSeries(hashtags, function(hashtag, callback){
                                    client.zscore('hashtag-'+hashtag, row.username, function(err, count){
                                        if(err) {
                                            callback(err);
                                        }
                                        row[hashtag] = count;
                                    });
                                    client.get('user-likes-'+row.username, function(err, count){
                                        if(err) {
                                            callback(err);
                                        }
                                        row.likes = count;
                                        client.get('user-comments-'+row.username, function(err, count){
                                            if(err) {
                                                callback(err);
                                            }
                                            row.comments = count;
                                            client.get('user-posts-'+row.username, function(err, count){
                                                if(err) {
                                                    callback(err);
                                                }
                                                row.posts = count;
                                                //add GEO!
                                                row.popularity = parseInt(row.comments) + parseInt(row.likes);
                                                callback();
                                            });
                                        });
                                    });
                                }, function(err){
                                    if(err) {
                                        callback(err);
                                    }
                                    callback();
                                });
                            });
                        }, function(err){
                            if(err) {
                                throw new Error(err);
                            }
                            console.log('done!!!!');
                            var sorted = bigData.sort(function(a, b){
                                return b.popularity - a.popularity;
                            });
                            var fields = [];
                            for(key in bigData[0]){
                                fields.push(key);
                            }
                            var d = new Date().getTime() / 1000;
                            var filename = data.hashtags.join('-')+'-'+d+'.csv';
                            json2csv({data: bigData, fields: fields}, function(err, csv) {
                                if (err) {
                                    console.log(err);
                                }
                                fs.writeFile('./public/csv/'+filename, csv, function(err) {
                                    if (err) {
                                        throw err;
                                    }
                                    console.log('file saved');
                                });
                            });
                            var downloadUrl = '/csv/'+filename;
                            io.emit('searchHashtagsWithDateDone', sorted.slice(0,50), downloadUrl);
                        });
                    });
                });
            });
        },

        startOver: function(notify){
            client.flushdb(function(err){
                if(err){
                    return console.log('error when attempting to flush db');
                }
                if(notify){
                    io.emit('startedOver');
                }
            });
        }
    };

};

