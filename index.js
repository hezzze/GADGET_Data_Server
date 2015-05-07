'use strict';

var MSECS_IN_DAY = 60 * 60 * 24 * 1000;
var MSECS_IN_HOUR = 60 * 60 * 1000;
var MSECS_IN_MIN = 60 * 1000;
var MSECS_IN_SEC = 1000;
var F_DEVICE_ID = "deviceId";
var F_ECG = "RawHeartValue";
var F_TIME_STAMP = "timeStamp";
var F_CATEGORIES = "categories";

var express = require('express');
var fs = require('fs');
var app = express();


//MongoDB
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _url = 'mongodb://localhost:27017/test';

var _users = [];
var _nLoaded = 0;
var _nUsers;
var _catInfos = {
    RawHeartValue: {
        idx: 0,
        round: false,
        scale: 1,
        origSampleRate: 125,
        hourSampleInterval: MSECS_IN_SEC
    },
    BPM: {
        idx: 1,
        round: true,
        scale: 1,
        origSampleRate: 0.25,
        hourSampleInterval: MSECS_IN_MIN
    },
    BodyTemp: {
        idx: 3,
        round: false,
        scale: 0.01,
        origSampleRate: 0.25,
        hourSampleInterval: MSECS_IN_MIN
    }
};


MongoClient.connect(_url, function(err, db) {
    assert.equal(null, err);

    var users = {};

    db.listCollections().toArray(function(err, items) {

        var regex = /(.+)\/(.+)/;
        var s, m, userId, deviceId;

        for (var i = 0; i < items.length; i++) {

            s = items[i].name;

            if (!regex.test(s)) continue;

            m = regex.exec(s);
            userId = m[1];
            deviceId = m[2];

            if (!users.hasOwnProperty(userId)) {
                users[userId] = [];
            }

            users[userId].push(deviceId);
        }


        console.log(users);

        _nUsers = users.length;

        // var u1 = "com:mdsol:users:52344b6e-e6d5-4ec2-b83d-bbc64725d189";
        // _users.push(new User(u1, users[u1], db));


        for (var u in users) {
            _users.push(new User(u, users[u], db));
        }

    });
});


function User(uuid, deviceIds, db) {

    this.uuid = uuid || "";

    var userObj = this;

    var info = {};

    function calcDeviceCompletionRate(deviceId, firstTime, lastTime, callback) {

        var rateSum = 0,
            nCategoryDone = 0;


        Object.keys(_catInfos).forEach(function(category) {
            var coll = db.collection(uuid + "/" + deviceId);
            var nTotal = Math.round((lastTime - firstTime) * _catInfos[category].origSampleRate / 1000);
            var query = {};
            query[F_CATEGORIES + "." + category] = {
                $exists: true
            };

            coll.count(query, function(err, actual) {

                
                var rate = actual / nTotal;

                //debug lines
                //console.log(uuid + "/" + deviceId + "->" + category);
                //console.log("Total records should be " + nTotal + ". Got " + actual + " (" + Math.round(rate * 100) + "%). origSampleRate: " +_catInfos[category].origSampleRate);

                rateSum += rate;
                nCategoryDone++;

                //check if all the category is processed
                if (nCategoryDone === Object.keys(_catInfos).length) {

                    //call the callback if all done
                    callback(rateSum / nCategoryDone);
                }
            });
        });
    }


    deviceIds.forEach(function(deviceId, idx) {

        var coll = db.collection(uuid + "/" + deviceId);
        var option = {};
        option[F_TIME_STAMP] = 1;

        var firstTime, lastTime;

        coll.find().sort(option).limit(1).next(function(err, firstDoc) {
            assert.equal(null, err);

            option[F_TIME_STAMP] = -1;
            coll.find().sort(option).limit(1).next(function(err, lastDoc) {
                assert.equal(null, err);

                firstTime = firstDoc[F_TIME_STAMP];
                lastTime = lastDoc[F_TIME_STAMP];

                //console.log(firstTime, lastTime);

                info[deviceId] = {
                    firstTime: firstTime,
                    lastTime: lastTime,
                    days: getDeviceDays(firstTime, lastTime)
                };



                calcDeviceCompletionRate(deviceId, firstTime, lastTime, function(rate) {
                    info[deviceId].completionRate = rate;

                    console.log(info[deviceId]);

                    //check if all the device is processed
                    if (idx === deviceIds.length - 1) {
                        userObj.info = info;

                        onLoadComplete(uuid, db);
                    }

                });
            });
        });
    });


    function getDeviceDays(firstTime, lastTime) {

        var totalMSeconds = lastTime - firstTime;

        var lastDayIdx = Math.floor(totalMSeconds / (MSECS_IN_DAY));


        var days = [];
        var fullDayHours = [];
        var lastDayHours = [];
        var startMin = new Date(firstTime).getUTCMinutes();
        var startHour = new Date(firstTime).getUTCHours();


        function fillHourStrings(hoursToFill, nHours, startHour, startMin) {
            var tmpHour;

            for (var j = 0; j < nHours; j++) {

                tmpHour = (startHour + j) % 24;

                hoursToFill.push(tmpHour + ":" + startMin + " - " + ((tmpHour + 1) % 24) + ":" + startMin);
            }
        }

        //every hour in a full day

        fillHourStrings(fullDayHours, 24, startHour, startMin);

        for (var i = 0; i < lastDayIdx; i++) {
            days.push(fullDayHours);
        }

        var hoursInLastDay = Math.ceil((totalMSeconds - lastDayIdx * MSECS_IN_DAY) / MSECS_IN_HOUR);

        fillHourStrings(lastDayHours, hoursInLastDay, startHour, startMin);

        days.push(lastDayHours);

        return days;
    }

}


function onLoadComplete(uuid, db) {
    console.log("Loading " + uuid + " completed...\n");
    _nLoaded++;
    if (_nLoaded === _users.length) {
        initServer();
        db.close();
    }
}




function initServer() {
    app.set('port', (process.env.PORT || 5000));
    app.use(express.static(__dirname + '/public'));


    app.get('/', function(request, response) {
        response.send("Hey, what's up!");
    });

    app.options('/info', function(req, resp) {
        resp.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': "GET OPTIONS",
            'Access-Control-Request-Method': "*",
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        });

        //When the parameter is an Array or Object, Express responds with the JSON representation:
        // http://expressjs.com/4x/api.html#res.send
        resp.send("OK");
    });

    app.get('/info', function(req, resp) {

        resp.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': "GET OPTIONS",
            'Access-Control-Request-Method': "*",
            'Access-Control-Allow-Headers': "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With"
        });
        resp.send(_users);

    });


    app.get('/user/:userIdx/info', function(req, resp) {

        resp.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': "GET OPTIONS",
            'Access-Control-Request-Method': "*",
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        });


        var userIdx;
        try {
            userIdx = parseInt(req.params.userIdx);
        } catch (e) {
            console.log(e.message);
            resp.sendStatus(404);
            return;
        }

        if (userIdx < 0 || userIdx > _users.length - 1) {
            resp.sendStatus(404);
            return;
        }

        resp.send(_users[userIdx].info);

    });


    app.options('/data', function(req, resp) {
        resp.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': "GET OPTIONS",
            'Access-Control-Request-Method': "*",
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        });

        //When the parameter is an Array or Object, Express responds with the JSON representation:
        // http://expressjs.com/4x/api.html#res.send
        resp.send("OK");
    });

    app.get('/user/:userIdx/data', function(req, resp) {


        var userIdx;
        try {
            userIdx = parseInt(req.params.userIdx);
        } catch (e) {
            console.log(e.message);
            resp.sendStatus(404);
            return;
        }

        if (userIdx < 0 || userIdx > _users.length - 1) {
            resp.sendStatus(404);
            return;
        }


        var user = _users[userIdx];
        var dvc = req.query.device;

        console.log("\nIncoming query for " + user.uuid);
        console.log(req.query);

        var dvcDays = user.info[dvc].days;

        var catInfo = _catInfos[req.query.category];

        if (![req.query.hour, dvc, req.query.day, req.query.category, catInfo].every(_isValid)) {
            resp.sendStatus(404);
            return;
        }

        resp.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': "GET OPTIONS",
            'Access-Control-Request-Method': "*",
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        });

        var dayIdx = parseInt(req.query.day);
        var hourIdx = parseInt(req.query.hour);
        var firstTime = user.info[dvc].firstTime;
        var resultData;

        var startTime = firstTime + dayIdx * MSECS_IN_DAY + hourIdx * MSECS_IN_HOUR;


        if (dayIdx >= 0 && hourIdx >= 0 && dayIdx <= dvcDays.length - 1 && hourIdx <= dvcDays[dayIdx].length - 1) {
            var info = {
                category: req.query.category,
                round: catInfo.round,
                startTime: startTime,
                scale: catInfo.scale,
                sampleInterval: catInfo.hourSampleInterval
            };


            MongoClient.connect(_url, function(err, db) {

                assert.equal(null, err);

                //set the range to be an hour
                var findOpt = {};
                findOpt[F_TIME_STAMP] = {
                    $gte: startTime,
                    $lt: startTime + MSECS_IN_HOUR
                };

                var sortOpt = {};
                sortOpt[F_TIME_STAMP] = 1;


                console.log("Querying the database for\n" + "user: " + user.uuid + "\ndevice: " + dvc);
                console.log(findOpt);


                db.collection(user.uuid + "/" + dvc).find(findOpt).sort(sortOpt).toArray(function(err, items) {

                    assert.equal(null, err);
                    resultData = getHourData(items, info);

                    //When the parameter is an Array or Object, Express responds with the JSON representation:
                    // http://expressjs.com/4x/api.html#res.send

                    db.close();

                    resp.send({
                        timeRange: [startTime, startTime + MSECS_IN_HOUR],
                        data: resultData,
                        completionRate: resultData.length / (MSECS_IN_HOUR / catInfo.hourSampleInterval)
                    });


                });
            });


        } else {
            resp.sendStatus(404);
        }

    });



    app.listen(app.get('port'), function() {
        console.log("Node app is running at localhost:" + app.get('port'));
    });



}

//info: {round: <boolean>,  category: <string>}
function getHourData(data, info) {

    console.log("Got " + data.length + " results");

    if (data.length < 10) console.log(data);


    var results = [];
    var i = 0;

    var sum, count, curTs;
    for (var ts = info.startTime;
        (i < data.length) && (ts < info.startTime + MSECS_IN_HOUR); ts += info.sampleInterval) {


        sum = 0;
        count = 0;

        curTs = data[i];

        while (curTs && curTs[F_TIME_STAMP] < ts + info.sampleInterval) {
            if (curTs[F_CATEGORIES].hasOwnProperty(info.category)) {
                sum += (+curTs[F_CATEGORIES][info.category]);
                count++;
            }
            i++;
            curTs = data[i];
        }

        if (count > 0) {
            results.push({
                val: (info.round ? Math.round(sum * info.scale / count) : sum * info.scale / count),
                date: new Date(ts).toISOString()
            });
        }

    }


    return results;

}

// Assert
// http://stackoverflow.com/questions/15313418/javascript-assert
function _assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

var _isValid = function(f) {
    return f !== undefined && f !== null;
};
