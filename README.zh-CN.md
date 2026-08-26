# Genogram Canvas

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个从 MyGenogramMaker 中抽离出来的开源、浏览器优先的家系图编辑器。

在线网站：[MyGenogramMaker](https://mygenogrammaker.com/)

部署后的根页面是本地项目 Dashboard。每个项目都可以进入编辑器，并自动保存到当前浏览器的 IndexedDB，不会上传到服务器。用户可以创建多个本地项目，下载和导入带版本号的 JSON 项目文件，并导出无水印 PNG 图片。

## 功能

- 人物、家庭边界、备注、文字、家庭秘密和关系线
- McGoldrick 风格的伴侣、亲子、兄弟姐妹、双胞胎和情感关系图形
- 撤销/重做、多选、拖动、调整大小、标签和视图控制
- 基于浏览器本地存储的多项目 Dashboard，支持新建、重命名、删除和下载
- 每个项目独立使用 IndexedDB 自动保存
- 带校验的版本化 JSON 导入与导出
- 无水印 PNG 导出
- 本地 MCP Server，可供 AI 生成并校验家系图项目
- 纯静态构建，不包含登录、支付、云端项目、数据分析或后端 API

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 验证

```bash
npm run test:genogram
npm run test:mcp
npm run lint
npm run build
```

`npm run build` 会把可部署的静态站点输出到 `out/`。

## 通过 MCP 让 AI 生成家系图

可选的本地 MCP Server 可以让兼容 MCP 的 AI 客户端生成可导入 Genogram Canvas 的项目。Server 不会自行调用模型、上传项目数据或要求 API Key。请使用仍在维护的 Node.js LTS 版本：20.19+、22.13+ 或 24+。

构建本地 MCP 可执行文件：

```bash
npm install
npm run mcp:build
```

添加到 Codex。请把路径替换成仓库在你电脑上的绝对路径：

```bash
codex mcp add genogram-canvas -- node /absolute/path/to/genogram-canvas/dist/genogram-mcp.mjs
```

其他 MCP 客户端可以使用对应的 stdio 配置：

```json
{
  "mcpServers": {
    "genogram-canvas": {
      "command": "node",
      "args": ["/absolute/path/to/genogram-canvas/dist/genogram-mcp.mjs"]
    }
  }
}
```

Server 提供三个工具：

- `generate_genogram`：把人物、家庭和关系转换成经过校验并自动布局的项目。
- `validate_genogram`：按照当前项目格式校验已有家系图。
- `get_genogram_notation`：列出可用的性别和关系类型。

可以在支持 MCP 的 AI 客户端中这样提问：

> 使用 `generate_genogram` 创建一张家系图：Alex 和 Jordan 已婚，他们的孩子是 Sam。Alex 出生于 1988 年，Jordan 出生于 1990 年，Sam 出生于 2016 年。

把工具返回的项目按照建议文件名保存为 JSON，然后从 Dashboard 导入。运行 `npm run test:mcp` 可以通过真实 stdio 连接验证打包后的 MCP Server。

## 部署

运行 `npm run build`，然后把 `out/` 目录中的内容上传到任意静态托管服务的根目录。不需要环境变量或后端服务。

## 隐私边界

家系图数据会保留在当前浏览器中，除非用户主动下载 JSON 或 PNG 文件。项目容量取决于浏览器可用存储空间。清除浏览器数据可能会删除全部本地项目，因此 JSON 下载是备份方式。本项目不宣称提供云端存储或端到端加密。

本地 MCP Server 不会发起网络请求，但用户写进提示词的信息可能会由其选择的 AI 客户端或模型服务商处理。在提交敏感的家庭或健康信息之前，请先查看相应服务商的隐私条款。

## 开源协议

[MIT](./LICENSE)
