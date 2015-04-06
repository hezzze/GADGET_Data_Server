'use strict';

var express = require('express');
var app = express();

// Load the SDK and UUID
var AWS = require('aws-sdk');
var uuid = require('node-uuid');

AWS.config.update({
    region: 'us-west-2'
});

var s3 = new AWS.S3();

var BUCKET_NAME = "medidatasiyang";
var FILE_KEY = "mockData.json";

var params = {
    Bucket: BUCKET_NAME,
    Key: FILE_KEY
};

var _rawDataJSON = "";
var _categories = {
    heart_rate: {
        idx: 0,
        round: true,
        sampleRate: 0.25
    },
    respiration_rate: {
        idx: 1,
        round: true,
        sampleRate: 0.25
    },
    skin_temperature: {
        idx: 2,
        round: false,
        sampleRate: 0.25
    }
};

s3.getObject(params).createReadStream().on('data', function(data) {
    _rawDataJSON += data;
}).on('end', initServer);


function initServer() {
    app.set('port', (process.env.PORT || 5000));
    app.use(express.static(__dirname + '/public'));

    app.get('/', function(request, response) {
        //response.send(_rawDataJSON);
    });

    app.get('/data', function(req, resp) {

        var dataSource = JSON.parse(_rawDataJSON);

        console.log(req.query);
        console.log(dataSource.length);

        var category = _categories[req.query.category];

        resp.headers('Access-Control-Allow-Origin','*');
        resp.headers('Access-Control-Allow-Methods','GET OPTIONS');
        resp.headers('Access-Control-Request-Method','*');
        resp.headers('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (req.query.hour) {
            var info = {
                dayIdx: parseInt(req.query.day),
                hourIdx: parseInt(req.query.hour),
                categoryIdx: category.idx,
                round: category.round,
                sampleRate: category.sampleRate,
                dateFieldIdx: 3
            };
            var resultData = getHourData(dataSource, info);

            //When the parameter is an Array or Object, Express responds with the JSON representation:
            // http://expressjs.com/4x/api.html#res.send
            resp.send(resultData);
        }

    });

    

    app.listen(app.get('port'), function() {
        console.log("Node app is running at localhost:" + app.get('port'));
    });



}

//info: {dayIdx: <integer>, hourIdx: <integer>, sampleRate: <float>, round: <boolean>,  categoryIdx: <integer>}
function getHourData(data, info) {

    var startIdx = Math.round((info.dayIdx * 24 + info.hourIdx) * 60 * 60 * info.sampleRate);

    //Entries per hour
    var len = Math.round(60 * 60 * info.sampleRate);

    return calcAvg(data, Math.round(60 * info.sampleRate), {
        idx: info.categoryIdx,
        round: info.round,
    }, {
        startIdx: startIdx,
        len: len,
        dateFieldIdx: info.dateFieldIdx
    });

}


//Assume lossless sorted data
//Output averaging values across n 
// samples

//n: how many entries to average
//field: {idx: <integer>, round: <boolean>}
//config: {startIdx: <integer>, len: <integer>, dateFieldIdx: <integer>, }
function calcAvg(data, n, field, config) {

    //Field names
    var F_WHICH_CHANGED = "which_changed",
        F_CHANGES = "changes",
        F_OLD = "old",
        F_NEW = "new";


    //number of data entries per result
    var nEntry = Math.floor(config.len / n);

    var results = [];

    var date;

    for (var i = 0; i < nEntry; i++) {

        date = data[i * n + config.startIdx][F_WHICH_CHANGED][F_CHANGES][config.dateFieldIdx][F_NEW];

        var sum = 0;
        var avg;

        //f.idx is the index in the changes array 
        //based on the mAudit specification
        for (var j = i * n + config.startIdx; j < (i + 1) * n + config.startIdx; j++) {
            //average values across n entries
            sum += data[j][F_WHICH_CHANGED][F_CHANGES][field.idx][F_NEW];
        }

        avg = sum / n;

        if (field.round) {
            avg = Math.floor(avg);
        }

        results.push({
            val: avg,
            date: date
        });

    }

    return results;

}
