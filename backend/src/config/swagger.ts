import swaggerJSDoc from 'swagger-jsdoc';

// Swagger配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '劳动仲裁调解系统 API 文档',
      version: '1.0.0',
      description: '劳动仲裁调解系统后端API接口文档',
      contact: {
        name: '系统开发团队',
        email: 'contact@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5002/api',
        description: '本地开发服务器'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/**/*.ts'
  ]
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export default swaggerSpec;