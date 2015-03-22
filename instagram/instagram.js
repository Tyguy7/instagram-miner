module.exports = function Instagram(request, async){
    
    return {
        getMediaAdvanced: function(clientId, startTime, endTime, lat, lng, dist, callback){
        
            if(!startTime || !endTime || !lat || !lng || !dist || !callback){
                throw new Error('ERROR! "getMediaNearLocation": Missing parameters');
            }

            var reqUrl = 'https://api.instagram.com/v1/media/search?client_id='+clientId+'&MIN_TIMESTAMP='+startTime+'&MAX_TIMESTAMP='+endTime+'&lat='+lat+'&lng='+lng+'&DISTANCE='+dist+'km';

            //console.log('requesting: '+reqUrl);
            process.stdout.write('getting instagram posts');
            var dots = setInterval(function(){
                process.stdout.write('.');
            }, 250);
            request(reqUrl, function(error, response, body) {
                clearInterval(dots);
                var data = JSON.parse(body);
                callback(data.data);
            });
        },

        getUserRecentMedia: function(clientId, userId, startTime, endTime, callback){

            if(!userId || !startTime || !endTime || !callback){
                throw new Error('ERROR! "getUserInfo": Missing parameters');
            }

            var reqUrl = 'https://api.instagram.com/v1/users/'+userId+'/media/recent?client_id='+clientId+'&MAX_TIMESTAMP='+startTime+'&MAX_TIMESTAMP='+endTime+'&COUNT=5000';

            console.log('requesting: '+reqUrl);
            process.stdout.write('getting posts by '+userId);
            var dots = setInterval(function(){
                process.stdout.write('.');
            }, 250);
            request(reqUrl, function(error, response, body) {
                clearInterval(dots);
                var data = JSON.parse(body);
                callback(data.data);
            });
        },

        getRecentMediaByTag: function(clientId, tag, maxToGet, storageFn, callback){

            if(!tag || !callback){
                throw new Error('ERROR! "getMediaByTag": Missing parameters');
            }

            var perpage = 20;
            var pagination = true;
            var total = 0;
            var gottenMedia = [];

            process.stdout.write('getting instagram posts');
            //while pagination exists, and haven't hit max, request data repeatedly
            async.whilst(
                function(){
                    return (pagination && total < maxToGet);
                },
                function (cb) {

                    var url = 'https://api.instagram.com/v1/tags/'+tag+'/media/recent?client_id='+clientId+'&COUNT='+perpage;
                    var reqUrl = (pagination && pagination.next_url) ? pagination.next_url : url;

                    //wait 500ms between requests
                    setTimeout(function(){
                        var dots = setInterval(function(){
                            process.stdout.write('.');
                        }, 100);
                        request(reqUrl, function(error, response, body){
                            if(error){
                                cb(error);
                            }
                            clearInterval(dots);
                            var data = JSON.parse(body);
                            if(data.meta && data.meta.code && data.meta.code==400){
                                //error from instagram
                                pagination = false;
                                callback('could not search term: '+tag);
                                return cb('could not search term: '+tag);
                            }
                            total+= data.data.length;
                            data.data.forEach(function(item){
                                if(gottenMedia.indexOf(item.id)>-1){
                                    cb('duplicate post ID!')
                                }
                                gottenMedia.push(item.id);
                            });
                            if(!data.pagination || !data.pagination.next_url){
                                pagination = false;
                            } else {
                                pagination = data.pagination;
                            }
                            storageFn(data.data);
                            cb();
                        });
                    }, 500);
                },
                function (err) {
                    if(err){
                        throw new Error('ERROR! "getMediaByTag": '+err);
                    } else {
                        callback(err, total);
                    }
                }
            );
        },

        searchHashtagsWithDate: function(clientId, hashtags, startDate, endDate, updateFn, callback){

            var numHashtags = hashtags.length;
            var gottenPosts = [];
            var gottenUsers = [];
            var results = [];

            //for each hastag, get all pages of specified range, storing all results
            var i = 0;
            async.eachSeries(hashtags, function(hashtag, callback){

                process.stdout.write('getting posts containing '+hashtag);

                var perpage = 1000; //lame, it seems to max out at 33
                var pagination = true;

                //while pagination exists, and haven't hit max, request data repeatedly
                async.whilst(
                    function(){
                        return (pagination);
                    },
                    function (callback) {

                        var url = 'https://api.instagram.com/v1/tags/'+hashtag+'/media/recent?client_id='+clientId+'&max_id='+endDate+'000000&min_id='+startDate+'000000&count='+perpage;
                        var reqUrl = (pagination && pagination.next_url) ? pagination.next_url : url;

                        //wait 0ms between requests
                        request(reqUrl, function(error, response, body){
                            var data = JSON.parse(body);
                            if(error || (data.meta && data.meta.code && data.meta.code==400)){
                                pagination = false;
                                callback('could not search term: '+hashtag);
                            } else {
                                //process
                                if(!data.pagination || !data.pagination.next_url){
                                    pagination = false;
                                } else {
                                    pagination = data.pagination;
                                }
                                var currDate;
                                data.data.forEach(function(item){
                                    if(gottenPosts.indexOf(item.id)>-1){
                                        //dupe, skip
                                    } else {
                                        //add to results array
                                        item.hitHashtag = hashtag;
                                        results.push(item);
                                        gottenPosts.push(item.id);
                                    }
                                    if(gottenUsers.indexOf(item.user.id)>-1){
                                        //dupe, skip
                                    } else {
                                        //add to results array
                                        gottenUsers.push(item.user.id);
                                    }
                                    currDate = item.created_time;
                                });
                                var htPercent = Math.ceil( (endDate - currDate) / (endDate - startDate) * 100 );

                                //sometimes the dates are off and we get crazy percentages, only push update if accurate
                                if(htPercent<=100){
                                    var updateData = {
                                        status: 'running',
                                        percentComplete: (htPercent / numHashtags) + (i * (100 / numHashtags) ),
                                        posts: gottenPosts.length,
                                        users: gottenUsers.length
                                    };
                                    updateFn(updateData);
                                    process.stdout.write(' '+updateData.percentComplete);
                                }
                                callback();
                            }
                        });
                    },
                    function (err) {
                        if(err){
                            throw new Error('ERROR! "searchHashtagsWithDate": '+err);
                        } else {
                            i++;
                            callback(null);
                        }
                    }
                );
            }, function(err){
                if(err){
                    throw new Error('ERROR! "searchHashtagsWithDate": '+err);
                } else {
                    var updateData = {
                        status: 'idle',
                        percentComplete: 100,
                        posts: gottenPosts.length,
                        users: gottenUsers.length
                    };
                    updateFn(updateData);
                    process.stdout.write(' '+updateData.percentComplete);
                    callback(null, results);
                }
            });
        }
    }
};