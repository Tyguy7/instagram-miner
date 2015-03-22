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

```
node app.js
```

The web app will be available at http://localhost:3000
