const { ApolloServer } = require('apollo-server');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: '.env' });

const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const conectarDB = require('./config/db');

//conetar a la bd
conectarDB();

//servidor
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers['authorization'] || '';

    if (token) {
      try {
        const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.Token);
        return {
          usuario
        }
      } catch (error) {
        console.log('Hubo un error');
        console.log(error);
      }
    }
  }
});


//arrancar server
server.listen().then(({ url }) => {
  console.log(`Servidor corriendo en la url ${url}`);
})