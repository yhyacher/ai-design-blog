/* --------------------------------------------------------------------------
   运行时配置
   以下 endpoint / publishableKey 来自云服务返回的 publicConfig。
   publishableKey 只用于标识「本应用」，本身不带任何权限；服务端会校验来源域名，
   因此它可以出现在前端代码里（浏览器中本来也可见），但不要写入日志。
   -------------------------------------------------------------------------- */

window.BLOG_CONFIG = {
  endpoint: 'https://ai-design-blog.app.workbuddy.host',
  publishableKey: 'wbpk_7cT3WH8ZQ3iMd23Rzz6Zxs_qEE5DdDeueP23EUStVWxx1smSdka45DL',

  siteName: '设计手札',
  siteTagline: '关于 AI 与产品设计的长期观察',
  defaultAuthor: '设计手札',

  // 单文件上传上限（字节）
  maxUploadBytes: 10 * 1024 * 1024,
  allowedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
  allowedFileTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/zip',
    'application/json',
  ],
};
