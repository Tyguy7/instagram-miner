# instagram-miner
Use this tool to mine Instagram data, and do some social engineering.  

Prerequisites
============

  * Node.js
  * A running Redis server

Warning!
============
This app requires exclusive control over Redis database #3.  The database is completely wiped before each search.  If you need to use a different database, change the targeted database in miner.js.   This app is also designed for single-user operation.  Multiple users accessing the web app will see the same output, and multiple users running queries at the same time could produce undesired results.  

Usage
============

```
git clone this repo
cd instagram-miner
npm install
```

Create a config.js file at the app root (same dir as app.js) with your Instagram client ID like so:
```javascript
module.exports = {
  clientId: 'yourInstagramCl!3nt1D';
};
```

Launch the app
```
node app.js
```

The web app will be available at http://localhost:3000

### Simple Mode:
Collects the most recently created posts (up to 250) that contain the 'mined' hashtag.  Provides a list of users that used the hashtag, and number of uses (posts that they tagged with it).  Hashtag intersections can be discovered by selecting any number of users and clicking 'compare selected'.  This will show all mutual hashtags within the data collected by the mining process (most recent 250 posts).  

Simple mode also provides a list of all hashtags used within the dataset, and the number of times each hashtag was used (number of posts it was found in).  Similar to the user list, the results in the hashtag list may also be compared for intersections.  Find all users who used a particular hashtag by selecting any number of hashtags in the list, and clicking 'compare selected'.  Search results can also be enriched by adding additional hashtags.

User list and hashtag lists can be filtered by username and hashtag respectively, by using the 'filter text' field.

Simple mode allows you to search for users who are interested in a subject, and discover other subjects relate to your search that might be relevant to you.  For example, if you searched for "lilbub", and noticed a lot of users also used the hashtag "drawing", you might discover that there is a serious fan art community for various felines that found their fame online. 

### Advanced Mode:


### Crashes:
Simply put, be smart about what you search for.  Do not go to the advanced tab and search for "happy" over the past month.  It will take days to complete, and will most likely crash the process due to low memory, or other resource barriers.  For advanced searching, a simple rule of thumb is to start small.  Always start small, and work your way up.
