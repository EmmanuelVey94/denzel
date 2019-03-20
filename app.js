const Express = require("express");
const BodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectID;
const imdb = require('./src/imdb');
const CONNECTION_URL = "mongodb+srv://Emmanuel:Jesuismoi1@cluster0-nk4cf.mongodb.net/test?retryWrites=true";
const DATABASE_NAME = "denzel";
const DENZEL_IMDB_ID = 'nm0000243';


var app = Express();

app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));

var database, collection;

app.listen(9292, () => {
    MongoClient.connect(CONNECTION_URL, { useNewUrlParser: true }, (error, client) => {
        if(error) {
            throw error;
        }
        database = client.db(DATABASE_NAME);
        collection = database.collection("movies");
        console.log("Connected to `" + DATABASE_NAME + "`!");
    });
});




app.get("/movies/populate", async (request, response) => {
    const movies = await imdb(DENZEL_IMDB_ID);
    collection.insert(movies, (error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        response.send(result.result);
    });
});
app.post("/movies/:id", (request, response) => {
    var review = response.body.review;
    var date = response.body.date;
    collection.aggregate([{$match:{"id": request.params.id}},{$set:{review:review,date:date}}], (error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        response.send(result.result);
    });
});
app.get("/movies", async (request, response) => {

    collection.find({metascore:{$gte:70}}).toArray((error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        const index = Math.floor(Math.random() * Math.floor(result.length));
        result = result[index];
        response.send(result);
    });
});
app.get("/movies/search", (request, response) => {
    const targetMetascore = +request.query.metascore ;
    const targetLimit = +request.query.limit;

    collection.find({
      metascore:{$gte:targetMetascore}
    }).limit(targetLimit).sort({metascore:-1}).toArray((error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        response.send(result);
    });
});
app.get("/movies/:id", (request, response) => {

    collection.findOne({"id": request.params.id}, (error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        response.send(result);
    });
});


//----------------------------GraphQL-------------------------------------------//


const { GraphQLObjectType,
    GraphQLString,
    GraphQLInt,
    GraphQLList,
    GraphQLFloat,
    GraphQLBoolean
} = require('graphql');

const fetch = require('node-fetch')

const movieType = new GraphQLObjectType({
  name: 'movie',
  fields : {
    id: { type: GraphQLString },
    link: { type: GraphQLString },
    metascore: { type: GraphQLInt },
    poster: { type: GraphQLString },
    rating: { type: GraphQLFloat },
    synopsis: { type: GraphQLString },
    title: { type: GraphQLString },
    votes: { type: GraphQLFloat},
    year: { type: GraphQLInt },
    date:{type: GraphQLString},
    review:{type:GraphQLString}
  }
});
const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {

    populate:{
      type: GraphQLInt,
      resolve: function() {
        return fetch('http://localhost:9292/movies/populate')
        .then(res => res.json())
        .then(json => json.total)
      }
    },

    randomMovie: {
      type: movieType,
      resolve: async function() {

        const res = await collection.find({metascore:{$gte:70}}).toArray();
        var random = Math.floor(Math.random() * Math.floor(res.length));
        return res[random];

      }
    },

    specMovie: {
      type: movieType,
      args: {
        id: { type: GraphQLString },
      },
      resolve: async function(source,args) {
        return fetch(`http://localhost:9292/movies/${args.id}`)
        .then(res => res.json())
      }
    },

    searchMovie: {
      type: GraphQLList(movieType),
      args: {
        limit: { type: GraphQLInt },
        metascore: {type: GraphQLInt}
      },
      resolve: async function(source,args) {
        const res = await fetch(`http://localhost:9292/movies/search?limit=${args.limit}&metascore=${args.metascore}`)
        const finalResult = await res.json();
        return finalResult.results;
      }
    },

    saveData: {
      type: GraphQLString,
      args: {
        id: { type: GraphQLString },
        date: {type: GraphQLString},
        review: {type: GraphQLString}
      },
      resolve : async function(source,args){
        collection.updateOne({ "id": args.id },{$set : {"date": args.date , "review": args.review}}, (error, result) => {
              if(error) {
                  return response.status(500).send(error);
              }
          });
          return `updateOK for ${args.id}`;

        }
    }


  }
});
//const {queryType} = require('./query.js');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const {GraphQLSchema} = require('graphql');
const schema = new GraphQLSchema({ query : queryType });

//Setup the nodejs GraphQL server
app.use('/graphql', graphqlHTTP({
    schema: schema,
    graphiql: true,
}));




//Define the Query
