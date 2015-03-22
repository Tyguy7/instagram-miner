var app = angular.module('app', []);

app.controller('indexController', function($scope){

    $scope.selectedTab = 'users';
    $scope.users = [];
    $scope.hashtags = [];
    $scope.tasks = [];
    var status = {};

    $scope.startMining = function(){
        console.log('start mining '+$scope.hashtagToMine);
        socket.emit('startMining', $scope.hashtagToMine);
        $scope.hashtagToMine = '';
    };

    $scope.hashtagFilter = function(value, index){
        if($scope.hashtagFilterText){
            return value.name.indexOf($scope.hashtagFilterText) == 0;
        }
        return true;
    };
    $scope.userFilter = function(value, index){
        if($scope.userFilterText){
            return value.username.indexOf($scope.userFilterText) == 0;
        }
        return true;
    };
    $scope.startOver = function(){
        socket.emit('startOver');
    };
    socket.on('startedOver', function () {

        console.log('starting fresh');
        $scope.$apply(function(){
            $scope.selectedTab = 'users';
            $scope.users = [];
            $scope.hashtags = [];
            $scope.tasks = [];
            var status = {};
        });
    });

    $scope.userCompareData = {users:[],hashtags:[]};
    $scope.compareUsers = function(){
        $scope.userCompareData.users = [];
        $scope.compareUserModal = true;
        $scope.users.forEach(function(user){
            if(user.selected){
                $scope.userCompareData.users.push(user.username);
            }
        });
        socket.emit('compareUsers', $scope.userCompareData.users);
        $scope.loadingComparison = true;
    };
    socket.on('comparedUsers', function (results) {

        console.log('comparedUsers', results);
        $scope.$apply(function(){
            $scope.userCompareResults = results;
            $scope.loadingComparison = false;
        });
    });

    $scope.hashtagCompareData = {users:[],hashtags:[]};
    $scope.compareHashtags = function(){
        console.log('compare hashtags');
        $scope.hashtagCompareData.hashtags = [];
        $scope.compareHashtagModal = true;
        $scope.hashtags.forEach(function(hashtag){
            if(hashtag.selected){
                $scope.hashtagCompareData.hashtags.push(hashtag.name);
            }
        });
        socket.emit('compareHashtags', $scope.hashtagCompareData.hashtags);
        $scope.loadingComparison = true;
    };
    socket.on('comparedHashtags', function (results) {

        console.log('comparedHashtags', results);
        $scope.$apply(function(){
            $scope.hashtagCompareResults = results;
            $scope.loadingComparison = false;
        });
    });

    socket.on('newTask', function (task) {
        $scope.tasks.push({name:task.name, posts: task.posts, status: task.status});
    });
    socket.on('updateTask', function (task) {
        $scope.tasks.forEach(function(t, idx){
            if(t.name==task.name){
                $scope.$apply(function(){
                    $scope.tasks[idx].posts = task.posts || $scope.tasks[idx].posts;
                    $scope.tasks[idx].status = task.status || $scope.tasks[idx].status;
                });
            }
        });
    });
    socket.on('newHashtag', function (hashtag) {
        var exists = false;
        $scope.hashtags.forEach(function(h, idx){
            if(h.name==hashtag.name){
                exists = true;
                //console.log('exists');
            }
        });
        if(!exists){
            //console.log('doesnt exist', hashtag);
            $scope.hashtags.push({name:hashtag.name, occurrences: 1});
        }
    });
    socket.on('updateHashtags', function (hts) {
        if(status.updatingHashtags){
            return;
        }
        status.updatingHashtags = true;
        hts.forEach(function(hashtag){
            $scope.hashtags.forEach(function(h, idx){
                if(h.name==hashtag.name){
                    $scope.$apply(function(){
                        $scope.hashtags[idx].occurrences = hashtag.occurrences || $scope.hashtags[idx].occurrences;
                    });
                }
            });
        });
        status.updatingHashtags = false;
    });
    socket.on('newUser', function (user) {
        var exists = false;
        $scope.users.forEach(function(u, idx){
            if(u.username==user.username){
                exists = true;
            }
        });
        if(!exists){
            $scope.users.push(user);
        }
    });
    socket.on('updateUsers', function (usrs) {
        if(status.updatingUsers){
            return;
        }
        status.updatingUsers = true;
        usrs.forEach(function(user){
            $scope.users.forEach(function(u, idx){
                if(u.username==user.username){
                    $scope.$apply(function(){
                        $scope.users[idx].hashtags = user.hashtags || $scope.users[idx].hashtags;
                    });
                }
            });
        });
        status.updatingUsers = false;
    });

    $scope.startOver();
});

app.controller('advancedController', function($scope){

    $scope.status = 'idle';

    $scope.startOver = function(){
        socket.emit('startOver');
    };
    socket.on('startedOver', function () {

        console.log('starting fresh');
        $scope.$apply(function(){
            $scope.status = 'idle';
            $scope.hashtags = '';
            $scope.percentComplete = '';
            $scope.numPosts = '';
            $scope.numUsers = '';
            $scope.sample = [];
            $scope.sampleHeader = [];
            $scope.downloadUrl = '';
        });
    });

    $scope.go = function(){
        if(!$scope.hashtags || !$scope.startDate || !$scope.endDate){
            return;
        }
        $scope.sample = [];
        $scope.sampleHeader = [];
        var ht = $scope.hashtags.split(',');
        //trim in case of whitespaces, and remove hash
        ht.forEach(function(hashtag, idx){
            ht[idx] = hashtag.trim().replace(/ /g,"");
        });
        var data = {
            hashtags: ht.filter(function(z){ return z!='';}),
            startDate: $scope.startDate,
            endDate: $scope.endDate
        }
        socket.emit('searchHashtagsWithDate', data);
        console.log('searchHashtagsWithDate', data);
    };

    socket.on('badData', function(data){
        console.log('yikes, bad data', data);
        alert('yikes, bad input data');
    });

    socket.on('searchHashtagsWithDateUpdate', function(data){
        $scope.$apply(function(){
            $scope.status = data.status;
            $scope.percentComplete = data.percentComplete;
            $scope.numPosts = data.posts;
            $scope.numUsers = data.users;
            console.log('update', data);
        });
    });

    socket.on('searchHashtagsWithDateDone', function(sample, downloadUrl){
        $scope.$apply(function(){
            console.log('searchHashtagsWithDateDone');
            $scope.sample = sample;
            for(key in sample[0]){
                $scope.sampleHeader.push(key);
            }
            $scope.downloadUrl = downloadUrl;
        });
    });

    $scope.startOver();
});

app.directive('datepicker', function(){
    return {
        link: function(scope, element, attrs){
            $( element ).datepicker({
                onClose: function(str){
                    scope.$apply(function(){
                        var unixtime = new Date(str).getTime() / 1000;
                        scope[attrs.mdl] = unixtime;
                    });
                }
            });
        }
    }
});