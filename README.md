# GADGET_Data_Server

This is an Node.js app for serving GADGET trial data based on the node [starter app](https://github.com/heroku/node-js-getting-started) from heroku.
It uses [Express 4](http://expressjs.com/).


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