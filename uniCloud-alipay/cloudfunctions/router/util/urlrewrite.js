/**
 * URL重写配置（Strapi 风格 REST API）
 *
 * 支持以下 URL 格式：
 *
 * 内容列表（Strapi 风格）：
 *   GET /http/router/content/article
 *   GET /http/router/content/article?locale=zh-Hans&sort=-publish_time&pagination[page]=1&pagination[pageSize]=10
 *
 * 内容详情（Strapi 风格）：
 *   GET /http/router/content/article/abc123
 *   GET /http/router/content/article/abc123?locale=zh-Hans&populate=model
 *
 * 旧版兼容（仍可使用）：
 *   GET /http/router/content/list?model_key=article
 *   GET /http/router/content/info?document_id=abc123
 */
module.exports = {
  rule: {
    // ==================== 示例规则 ====================
    '^aaa$': 'template/db_api/pub/select',
    '^findById/(.+)': 'template/db_api/pub/findById?_id=$1',

    // ==================== 旧版兼容接口（必须优先匹配） ====================
    // 旧版列表接口 - 必须在动态规则之前
    '^content/list$': 'client/pub_content.getListLegacy',
    // 旧版详情接口 - 必须在动态规则之前
    '^content/info$': 'client/pub_content.getInfoLegacy',

    // ==================== Strapi 风格内容接口 ====================
    // 内容详情：/content/{model_key}/{document_id}
    '^content/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)$': 'client/pub_content.getInfo?model_key=$1&document_id=$2',

    // 内容列表：/content/{model_key}
    '^content/([a-zA-Z0-9_-]+)$': 'client/pub_content.getList?model_key=$1',
  },
  config: {
    // 当设置为true时，只有符合url重写规则内的云函数才可以被url化访问
    accessOnlyInRule: false,
  },
};
