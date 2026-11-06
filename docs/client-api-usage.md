# 前台内容查询接口调用示例

## 接口说明

提供两个公开的内容查询接口，无需登录即可访问：

1. **获取内容列表** - `client/pub.content.getList`
2. **获取内容详情** - `client/pub.content.getInfo`

---

## 方式一：使用 vk.importObject() 调用（推荐）

适用于 uni-app 前端，通过 vk 框架调用云对象

### 1. 获取内容列表

```javascript
// 在页面或组件中
let vk = uni.vk;

// 导入云对象
const contentApi = vk.importObject('client/pub.content');

// 调用列表接口
async function loadContentList() {
  try {
    let res = await contentApi.getList({
      data: {
        model_key: 'article',      // 必填：模型标识
        locale: 'zh-Hans',         // 可选：语言代码
        pageIndex: 1,              // 可选：页码，默认1
        pageSize: 10,              // 可选：每页数量，默认10
        keyword: '技术'            // 可选：搜索关键词
      }
    });
    
    console.log('列表数据：', res.rows);
    console.log('总数：', res.count);
  } catch (err) {
    console.error('请求失败：', err);
  }
}
```

### 2. 获取内容详情

```javascript
// 导入云对象
const contentApi = vk.importObject('client/pub.content');

// 调用详情接口
async function loadContentDetail() {
  try {
    let res = await contentApi.getInfo({
      data: {
        document_id: 'abc123',     // 必填：内容文档ID
        locale: 'zh-Hans'          // 可选：语言代码
      }
    });
    
    console.log('内容详情：', res.info);
  } catch (err) {
    console.error('请求失败：', err);
  }
}
```

---

## 方式二：使用 URL 化 HTTP 请求

适用于外部系统、H5、小程序等通过 HTTP 直接访问

### URL 格式

```
https://<your-cloud-url>/http/router/client/pub/content/<method>?<params>
```

### 1. 获取内容列表

**请求示例：**

```javascript
// 使用 vk.request()
vk.request({
  url: 'https://xxx.bspapp.com/http/router/client/pub/content.getList',
  method: 'POST',
  data: {
    model_key: 'article',
    locale: 'zh-Hans',
    pageIndex: 1,
    pageSize: 10
  },
  success: (res) => {
    console.log('列表数据：', res.data.rows);
  }
});

// 或使用 uni.request()
uni.request({
  url: 'https://xxx.bspapp.com/http/router/client/pub/content.getList',
  method: 'POST',
  data: {
    model_key: 'article',
    locale: 'zh-Hans',
    pageIndex: 1,
    pageSize: 10
  },
  success: (res) => {
    console.log('列表数据：', res.data.rows);
  }
});
```

**curl 示例：**

```bash
curl -X POST "https://xxx.bspapp.com/http/router/client/pub/content.getList" \
  -H "Content-Type: application/json" \
  -d '{
    "model_key": "article",
    "locale": "zh-Hans",
    "pageIndex": 1,
    "pageSize": 10
  }'
```

### 2. 获取内容详情

**请求示例：**

```javascript
vk.request({
  url: 'https://xxx.bspapp.com/http/router/client/pub/content.getInfo',
  method: 'POST',
  data: {
    document_id: 'abc123',
    locale: 'zh-Hans'
  },
  success: (res) => {
    console.log('内容详情：', res.data.info);
  }
});
```

---

## 参数说明

### getList 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model_key | String | 是 | 模型标识，如 'article'、'page' |
| locale | String | 否 | 语言代码，如 'zh-Hans'、'en' |
| pageIndex | Number | 否 | 页码，默认 1 |
| pageSize | Number | 否 | 每页数量，默认 10 |
| keyword | String | 否 | 搜索关键词（搜索标题字段） |

### getInfo 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| document_id | String | 是 | 内容文档ID |
| locale | String | 否 | 语言代码 |

---

## 返回数据结构

### getList 返回

```javascript
{
  code: 0,
  msg: '',
  rows: [                    // 内容列表
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
  count: 100                 // 总数
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
    model_key: 'article',
    title: '文章标题',
    description: '文章摘要',
    content: '文章正文',
    cover: '封面图URL',
    author: '作者',
    publish_time: 1234567890,
    locale: 'zh-Hans',
    status: true,
    model: {                 // 关联的模型信息
      _id: 'model_xxx',
      name: '文章',
      key: 'article'
    },
    // 其他模型定义的公开字段...
  }
}
```

---

## 错误处理

### 常见错误码

| code | msg | 说明 |
|------|-----|------|
| 0 | '' | 请求成功 |
| -1 | 缺少必填参数：xxx | 参数缺失 |
| -1 | 模型不存在 | model_key 错误 |
| -1 | 内容不存在或已下架 | document_id 错误或内容未发布 |

### 错误处理示例

```javascript
async function fetchContent() {
  try {
    let res = await contentApi.getList({
      data: { model_key: 'article' }
    });
    
    if (res.code === 0) {
      // 成功处理
      console.log('数据：', res.rows);
    } else {
      // 业务错误
      console.error('错误：', res.msg);
      uni.showToast({ title: res.msg, icon: 'none' });
    }
  } catch (err) {
    // 请求异常
    console.error('请求失败：', err);
    uni.showToast({ title: '网络请求失败', icon: 'none' });
  }
}
```

---

## 注意事项

1. **公开接口**：这两个接口无需登录即可访问，适合前台内容展示
2. **只返回已发布内容**：接口自动过滤 `status: false` 的未发布内容
3. **字段过滤**：接口只返回公开字段，敏感字段（如创建者ID、更新者ID等）会被过滤
4. **URL化地址**：需要替换为实际的云函数URL化地址
5. **跨域问题**：H5端调用需注意跨域配置

---

## 快速测试

在浏览器控制台测试（需先引入 vk 框架）：

```javascript
// 测试列表接口
uni.vk.importObject('client/pub.content').getList({
  data: { model_key: 'article', pageSize: 5 }
}).then(res => console.log(res));

// 测试详情接口
uni.vk.importObject('client/pub.content').getInfo({
  data: { document_id: 'your_document_id' }
}).then(res => console.log(res));
```
