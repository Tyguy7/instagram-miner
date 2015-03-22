
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.render('index.ejs', { title: 'Instagram Miner' });
};

exports.advanced = function(req, res){
    res.render('advanced.ejs', { title: 'Instagram Miner' });
};