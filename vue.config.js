module.exports = {
  chainWebpack: config => {
    config.module
      .rule('rules')
      .test(/\.(png|jpe?g|gif|svg|cur)(\?.*)?$/)
      .use('url-loader')
      .loader('url-loader')
      .end();
  },
  devServer: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
};
  