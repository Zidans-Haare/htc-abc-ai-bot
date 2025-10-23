const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HTW ABC AI Bot API',
      version: '2.0.0',
      description: 'API für den HTW ABC AI Bot System',
    },
    servers: [
      {
        url: 'https://aski.htw-dresden.de',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session_token',
        },
      },
    },
    security: [
      {
        sessionAuth: [],
      },
    ],
  },
  apis: ['./server/controllers/*.cjs', './server/controllers/admin/*.cjs'], // Pfade zu den API-Dateien
};

const specs = swaggerJSDoc(options);

module.exports = {
  swaggerUi,
  specs,
};
