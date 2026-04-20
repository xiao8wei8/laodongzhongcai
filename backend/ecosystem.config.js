module.exports = {
  apps: [
    {
      name: 'laodongzhongcai-backend',
      script: './dist/server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5003,
        DB_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5003,
        DB_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5003,
        DB_ENV: 'development'
      },
      kill_timeout: 5000,
      restart_delay: 4000
    }
  ]
};
