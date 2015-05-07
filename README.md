# GADGET_Data_Server

This is an barebone Node.js app for serving GADGET trial data based on the node [starter app](https://github.com/heroku/node-js-getting-started) from heroku.
It uses [Express 4](http://expressjs.com/).

## Data Schema

The app read data from the `test` table in MongoDB. The table should have collections named after a combination of user id and device id: 

`com:mdsol:users:023e65de-a6d0-45eb-ae9e-c17adad47f45/com:mdsol:devices:2735dddf-8400-52b1-aeb4-bee31ec07dab`

For each document under a collection, the schema:

```
{
    timeStamp: integer
    categories: {
        RawHeartValue: string
        BodyTemp: string
        ...
    }
}
```

## Running Locally

Make sure you have [Node.js](http://nodejs.org/) and the [Heroku Toolbelt](https://toolbelt.heroku.com/) installed.

```sh
$ git clone https://github.com/hezzze/GADGET_Data_Server.git
$ cd GADGET_Data_Server
$ npm install
$ npm start
```

Your app should now be running on [localhost:5000](http://localhost:5000/).

## Deploying to Heroku

```
$ heroku create
$ git push heroku master
$ heroku open
```
