# AGENTS.md — vk-unicloud-admin 多站点内容管理系统后台

## 项目性质
- Vue 2 + uni-app 前端 + uniCloud 云函数（单路由模式）后端，开发 IDE 为 HBuilderX
- 基于 JSON 驱动的「万能表格」`vk-data-table` 和「万能表单」`vk-data-form` 快速搭建 CRUD 页面

## 关键命令
```
npm test            # 仅存桩，无实际测试
```
**无构建/开发/类型检查脚本** — 构建与部署通过 HBuilderX IDE 菜单操作。

## 配置清单
| 文件 | 用途 |
|---|---|
| `app.config.js` | 应用核心配置（debug、登录页、主题、错误码等） |
| `app.config.menu.js` | 加载 `static_menu/menu.json` + dev 合并 `menu-dev.json` |
| `pages.json` | 页面路由（生产） |
| `pages-dev.json` | 页面路由（开发额外） |
| `pages.js` | 根据环境合并 pages.json + pages-dev.json |
| `prettier.config.js` | 格式化标准：printWidth 180, singleQuote, trailingComma es5, endOfLine lf |

## 环境变量
| 变量名 | 值 | 用途 |
|---|---|---|
| `uniCloud目录` | `E:\Works\uniapp\多站点内容管理系统后台\uniCloud-alipay` | 后端代码所在目录 |
| `router主函数名` | `router` | 云函数主函数名称 |
| `文档根目录` | `E:\Works\uniapp\vk-unicloud-docs\docs` | 项目文档存放目录 |

**注意**：
- `uniCloud目录` 为后端代码所在目录，且后端默认使用 `router主函数`，位于 `${uniCloud目录}/cloudfunctions/${router主函数名}` 目录下，当需要编写云函数、云对象等后端代码时，默认均写在此目录下
- 当需要查看文档时，优先在 `文档根目录` 下查看
- 在所有的 `skills` 中，当有写 `${uniCloud目录}/cloudfunctions/${router主函数名}` 这样的方式时，最终文件地址需要替换为绝对路径拼接

## 架构要点
- **前端入口**: `main.js` → Vue 2 + Element UI 2.15 + Umy UI + vk-unicloud + vk-unicloud-admin-ui
- **路由模式**: H5 hash 模式，base `/admin/`
- **云函数**: `uniCloud-alipay/cloudfunctions/router/`，vk-unicloud-router 中间件架构（8 个中间件）
- **数据库**: `uniCloud-alipay/database/` 下 58 个 JQL schema 文件
- **权限**: uni-id 用户/角色/权限层级
- **主题**: 3 套内置（white / black / blackWhite），`app.config.js` 切换
- **国际化**: zh-Hans / zh-Hant / en

## 开发流程要点
1. 修改页面路由需同步更新 `pages.json` + `pages.js`（环境感知合并逻辑）
2. 调试/演示页在 `pages_template/`，仅开发环境加载
3. 云函数 service 层按目录自动发现（`service/admin/`, `service/client/`, `service/user/` 等）
4. 新增中间件需在 `middleware/modules/` 下创建，并在 `middleware/index.js` 注册
5. 菜单修改需同时更新 `static_menu/menu.json`（生产）和 `menu-dev.json`（开发）
6. 创建新页面必须使用 `pages_template/kong/` 下的模板：
   - **列表页面** → 基于 `pages_template/kong/list.vue`（含 vk-data-table-query + vk-data-table + vk-data-dialog + vk-data-form 标准模板）
   - **其他页面** → 基于 `pages_template/kong/kong.vue`（空白页模板）

## 格式化
- Prettier 配置已就绪，修改代码后执行 `npx prettier --write <文件>` 保持风格一致
- 不允许使用 ESLint / TypeScript

## 强制规则
- 所有回复、文档、思考过程必须使用**简体中文**
- 所有弹窗打开必须使用 `vk.pubfn.openForm` 方法，不得直接操作 `show` 属性
