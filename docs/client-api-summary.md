# Client 端内容查询接口实现总结

## 实现概述

为前台提供了两个公开的内容查询接口,无需登录即可访问,支持 URL 化 HTTP 请求。

## 创建的文件

### 1. 云对象文件
**路径**: `uniCloud-alipay/cloudfunctions/router/service/client/pub/content.js`

**提供的接口**:
- `getList` - 获取公开内容列表
- `getInfo` - 获取内容详情

**特性**:
- ✅ 无需登录鉴权(pub 类型)
- ✅ 只返回已发布的内容(status: true)
- ✅ 自动过滤敏感字段
- ✅ 支持多语言查询
- ✅ 支持关键词搜索
- ✅ 支持分页

### 2. 文档文件
**路径**: `docs/client-api-usage.md`

包含完整的接口说明、调用示例、参数说明、返回数据结构等。

### 3. 示例页面
**路径**: `pages_template/client-api-demo/content-demo.vue`

提供了可视化的接口测试页面,包含:
- 列表查询表单
- 详情查询表单
- 代码示例展示

## 接口调用方式

### 方式一: vk.importObject (推荐)

```javascript
// 导入云对象
const contentApi = vk.importObject('client/pub.content');

// 获取列表
let res = await contentApi.getList({
  data: {
    model_key: 'article',
    locale: 'zh-Hans',
    pageIndex: 1,
    pageSize: 10
  }
});

// 获取详情
let res = await contentApi.getInfo({
  data: {
    document_id: 'abc123',
    locale: 'zh-Hans'
  }
});
```

### 方式二: URL 化 HTTP 请求

```
POST https://<your-cloud-url>/http/router/client/pub/content.getList
Content-Type: application/json

{
  "model_key": "article",
  "locale": "zh-Hans",
  "pageIndex": 1,
  "pageSize": 10
}
```

```
POST https://<your-cloud-url>/http/router/client/pub/content.getInfo
Content-Type: application/json

{
  "document_id": "abc123",
  "locale": "zh-Hans"
}
```

## 接口参数说明

### getList 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model_key | String | 是 | 模型标识(如 'article', 'page') |
| locale | String | 否 | 语言代码(如 'zh-Hans', 'en') |
| pageIndex | Number | 否 | 页码,默认 1 |
| pageSize | Number | 否 | 每页数量,默认 10 |
| keyword | String | 否 | 搜索关键词(搜索标题) |

### getInfo 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| document_id | String | 是 | 内容文档ID |
| locale | String | 否 | 语言代码 |

## 返回数据结构

### getList 返回

```javascript
{
  code: 0,
  msg: '',
  rows: [
    {
      _id: 'xxx',
      document_id: 'abc123',
      model_key: 'article',
      title: '文章标题',
      description: '文章摘要',
      cover: '封面图URL',
      author: '作者',
      publish_time: 1234567890,
      locale: 'zh-Hans',
      status: true
    }
  ],
  count: 100
}
```

### getInfo 返回

```javascript
{
  code: 0,
  msg: '',
  info: {
    _id: 'xxx',
    document_id: 'abc123',
    title: '文章标题',
    content: '文章正文',
    author: '作者',
    publish_time: 1234567890,
    locale: 'zh-Hans',
    status: true,
    model: { ... },
    // 其他模型定义的公开字段
  }
}
```

## 安全特性

1. **无需登录**: pub 类型接口,任何人都可以访问
2. **只返回已发布内容**: 自动过滤 status: false 的草稿
3. **字段过滤**: 只返回公开字段,敏感字段(创建者ID、更新者ID等)被过滤
4. **参数校验**: 必填参数缺失时返回明确错误提示

## URL 化配置说明

vk 框架默认支持 URL 化访问,无需额外配置:
- `accessOnlyInRule: false` - 所有云函数都可被 URL 化访问
- URL 格式: `https://<your-cloud-url>/http/router/<云对象路径>.<方法名>`

如需限制访问,可在 `uniCloud-alipay/cloudfunctions/router/util/urlrewrite.js` 中配置白名单。

## 测试步骤

1. **部署云函数**: 在 HBuilderX 中右键 `router` 云函数,选择"上传部署"
2. **访问示例页面**: 在浏览器中打开 `/pages_template/client-api-demo/content-demo`
3. **测试接口**: 
   - 输入模型标识(如 'article')
   - 点击"查询列表"
   - 查看返回的数据

## 后续扩展建议

1. **缓存机制**: 对热门内容添加 Redis 缓存
2. **访问统计**: 记录接口调用次数和热门内容
3. **SEO 优化**: 为 URL 化接口生成 sitemap
4. **权限细化**: 支持按栏目/分类控制访问权限
5. **字段自定义**: 允许前端指定返回的字段列表

## 注意事项

1. ⚠️ URL 化地址需要替换为实际的云函数 URL
2. ⚠️ H5 端调用需注意跨域配置
3. ⚠️ 生产环境建议配置请求频率限制
4. ⚠️ 敏感内容建议在模型字段配置中标记为"不公开"

## 相关文件清单

```
uniCloud-alipay/cloudfunctions/router/service/client/pub/
  └── content.js                          # 云对象实现

docs/
  └── client-api-usage.md                 # 接口文档

pages_template/client-api-demo/
  └── content-demo.vue                    # 示例页面

uniCloud-alipay/cloudfunctions/router/util/
  └── urlrewrite.js                       # URL 化配置(无需修改)
```
