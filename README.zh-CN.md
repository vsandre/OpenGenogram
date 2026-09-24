<div align="center">

# 🧬 OpenGenogram

**面向心理咨询师、社会工作者、教育者和学生的现代开源、浏览器优先、McGoldrick 风格家系图编辑器。**

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![MCP Supported](https://img.shields.io/badge/MCP-Supported-7c3aed.svg)](https://modelcontextprotocol.io/)
[![Static Export](https://img.shields.io/badge/Deploy-Static_Export-0ea5e9.svg)](#部署)
[![Issues Welcome](https://img.shields.io/badge/Issues-welcome-brightgreen.svg)](https://github.com/vsandre/OpenGenogram/issues)

</div>

---

## 为什么选择 OpenGenogram？

绘制家庭结构图不应该依赖通用绘图工具，也不应该把时间浪费在反复对齐人物和关系线上。

Genogram Canvas 提供专门用于结构化家系图的编辑器，同时让开源版本保持本地运行、代码可检查。

| 常见方式 | OpenGenogram |
|---|---|
| 通用绘图或幻灯片工具 | 提供专门的人物、家庭和情感关系元素 |
| 只能安装在桌面端的软件 | 使用浏览器界面，也可部署为纯静态网站 |
| 云端优先的编辑器 | 项目保存在当前浏览器的 IndexedDB 中 |
| 手动整理资料和排版 | 可选 MCP 工具可生成、校验并自动布局可导入项目 |

## 核心功能

- **McGoldrick 风格符号：** 支持人物、家庭边界、备注、家庭秘密和关系线。
- **家庭与情感关系：** 支持伴侣、亲子、兄弟姐妹、双胞胎、收养或寄养，以及情感关系图形。
- **实用编辑能力：** 支持撤销与重做、多选、拖动、调整大小、标签和视图控制。
- **本地多项目工作区：** 可以新建、重命名、删除和重新打开保存在当前浏览器中的项目。
- **可迁移项目文件：** 支持带校验的版本化 JSON 导入与导出。
- **无水印 PNG 导出：** 开源版画布可以导出无水印 PNG 图片。
- **本地 MCP Server：** 通过兼容的 AI 客户端生成和校验家系图项目。
- **纯静态、无后端依赖：** 不包含登录、支付、数据分析、云端项目存储或后端 API。

## AI 工作流：把案例笔记变成家系图

可选的本地 MCP Server 可以让 Codex、Claude Desktop、Cursor 等兼容 MCP 的客户端，根据结构化案例信息生成自动布局的家系图项目。

1. 先从案例笔记中移除身份信息和不必要的敏感内容。
2. 让支持 MCP 的 AI 客户端调用 `generate_genogram`。
3. 按建议文件名保存返回的项目 JSON。
4. 从 Genogram Canvas Dashboard 导入该 JSON 文件。

示例提示词：

> 使用 `generate_genogram` 创建一张家系图：Alex 和 Jordan 已婚，他们的孩子是 Sam。Alex 出生于 1988 年，Jordan 出生于 1990 年，Sam 出生于 2016 年。请返回可导入 Genogram Canvas 的项目。

MCP Server 本身不会调用模型或发起网络请求，但你选择的 AI 客户端或模型服务商仍可能处理提交的文字。处理敏感信息前，请先阅读[隐私边界](#隐私边界)。

## 开发者快速开始

请使用仍在维护的 Node.js LTS 版本：20.19+、22.13+ 或 24+。

```bash
git clone https://github.com/vsandre/OpenGenogram.git
cd OpenGenogram
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 本地 MCP Server

构建 MCP 可执行文件：

```bash
npm run mcp:build
```

添加到 Codex。请把示例路径替换成仓库在你电脑上的绝对路径：

```bash
codex mcp add OpenGenogram -- node /absolute/path/to/OpenGenogram/dist/genogram-mcp.mjs
```

Claude Desktop、Cursor 和其他支持 stdio 的 MCP 客户端可以使用对应配置：

```json
{
  "mcpServers": {
    "OpenGenogram": {
      "command": "node",
      "args": ["/absolute/path/to/OpenGenogram/dist/genogram-mcp.mjs"]
    }
  }
}
```

Server 提供三个工具：

- `generate_genogram`：把人物、家庭和关系转换成经过校验并自动布局的项目。
- `validate_genogram`：按照当前项目格式校验已有家系图。
- `get_genogram_notation`：列出可用的性别和关系类型。

运行 `npm run test:mcp`，可以通过真实 stdio 连接验证打包后的 MCP Server。

## 验证

```bash
npm run test:genogram
npm run test:mcp
npm run lint
npm run build
```

`npm run build` 会把可部署的静态站点输出到 `out/`。

## 部署

运行 `npm run build`，然后把 `out/` 目录中的内容上传到任意静态托管服务的根目录。开源应用不需要环境变量或后端服务。

## 隐私边界

在这个独立开源版本中，家系图数据会保留在当前浏览器内，除非用户主动下载 JSON 或 PNG 文件。患者身份信息、姓名和图表不会发送到本项目的后端。

项目容量取决于浏览器可用存储空间。清除浏览器数据可能会删除全部本地项目，因此重要项目请下载 JSON 备份。

本地 MCP Server 不会发起网络请求，但提示词中的信息仍可能由你选择的 AI 客户端或模型服务商处理。提交敏感的家庭或健康信息之前，请先查看相应服务商的条款。

仅采用本地优先架构并不代表已经满足 HIPAA 或其他法规要求。机构仍需根据自己的制度、设备、工作流程和服务商进行合规评估。

## 参与贡献

欢迎开发者和家系图领域的实践者参与贡献。

- 缺少某种符号或关系类型？请附上参考资料和使用场景，[提交 Issue](https://github.com/vsandre/OpenGenogram/issues)。
- 发现 Bug 或有改进建议？欢迎提交范围清晰的 Pull Request。

## 开源协议

OpenGenogram 使用 [MIT License](./LICENSE)。This product is derived from [Genogram Canvas](https://github.com/Brewnut-98/genogram-canvas) version 1.0.0. 第三方依赖声明请查看 [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)。
