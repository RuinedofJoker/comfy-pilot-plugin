# Comfy Pilot Bridge

ComfyUI PostMessage 通信桥接插件，用于 iframe 集成场景。支持工作流管理、执行控制和输出获取。

## ✨ 功能特性

- ✅ **工作流管理**
  - 自动监听工作流变化并推送
  - 获取当前工作流数据
  - 设置/加载工作流内容
  - 创建新的空白工作流

- ✅ **执行控制**
  - 执行当前工作流
  - 自动获取执行输出（图片、视频、音频等）
  - 实时执行状态反馈
  - 错误处理和超时保护

- ✅ **输出管理**
  - 自动构建资源访问 URL
  - 支持多种输出类型（图片、视频、GIF、音频）
  - 按节点组织的输出数据
  - 完整的执行历史信息

- ✅ **通信机制**
  - 基于 PostMessage 的安全通信
  - 请求-响应模式（requestId 追踪）
  - 统一的错误处理
  - 插件状态检测

## 📦 安装

插件已在 `custom_nodes/comfy-pilot-plugin` 目录中，重启 ComfyUI 即可生效。

启动后，在浏览器控制台会看到：
```
[Comfy Pilot Bridge] 初始化中...
[Comfy Pilot Bridge] 已启用
```

## 🚀 快速开始

### 基础集成示例

```html
<!DOCTYPE html>
<html>
<head>
  <title>ComfyUI 集成示例</title>
</head>
<body>
  <iframe id="comfyui" src="http://localhost:8188" width="100%" height="800px"></iframe>

  <script>
    const iframe = document.getElementById('comfyui');

    // 等待 iframe 加载
    iframe.onload = () => {
      // 检测插件是否就绪
      iframe.contentWindow.postMessage({
        type: 'comfy-pilot:ping',
        requestId: 'ping-1'
      }, '*');
    };

    // 监听所有响应
    window.addEventListener('message', (event) => {
      console.log('收到消息:', event.data);
    });
  </script>
</body>
</html>
```

## 📖 API 文档

### 消息协议

所有消息类型以 `comfy-pilot:` 前缀开头，避免与其他插件冲突。

#### 消息格式

**发送消息：**
```javascript
{
  type: 'comfy-pilot:xxx',      // 消息类型
  payload: {...},                // 数据负载（可选）
  requestId: 'unique-id'         // 请求ID（用于追踪响应）
}
```

**接收响应：**
```javascript
{
  type: 'comfy-pilot:xxx',      // 响应类型
  payload: {...},                // 响应数据
  requestId: 'unique-id',        // 对应的请求ID
  timestamp: 1234567890          // 时间戳
}
```

### API 列表

#### 1. 检测插件状态 (ping)

**发送：**
```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:ping',
  requestId: 'ping-1'
}, '*');
```

**响应：**
```javascript
{
  type: 'comfy-pilot:pong',
  payload: { version: '1.0.0' },
  requestId: 'ping-1'
}
```

#### 2. 获取当前工作流

**发送：**
```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:get-workflow',
  requestId: 'get-wf-1'
}, '*');
```

**响应：**
```javascript
{
  type: 'comfy-pilot:workflow-data',
  payload: {
    nodes: [...],
    links: [...],
    groups: [...],
    config: {...}
  },
  requestId: 'get-wf-1'
}
```

#### 3. 设置工作流内容

**发送：**
```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:set-workflow',
  payload: workflowData,  // 完整的工作流对象
  requestId: 'set-wf-1'
}, '*');
```

**响应：**
```javascript
{
  type: 'comfy-pilot:workflow-set',
  payload: { success: true },
  requestId: 'set-wf-1'
}
```

#### 4. 创建新工作流

**发送：**
```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:new-workflow',
  requestId: 'new-wf-1'
}, '*');
```

**响应：**
```javascript
{
  type: 'comfy-pilot:workflow-created',
  payload: { success: true },
  requestId: 'new-wf-1'
}
```

#### 5. 执行工作流 ⭐

**发送：**
```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:execute-workflow',
  payload: {
    batchCount: 1  // 可选，批次数量，默认为 1
  },
  requestId: 'exec-1'
}, '*');
```

**成功响应：**
```javascript
{
  type: 'comfy-pilot:execution-result',
  payload: {
    success: true,
    promptId: 'abc123-def456-...',
    outputs: {
      promptId: 'abc123-def456-...',
      outputs: {
        "9": {  // 节点 ID
          images: [
            {
              filename: "ComfyUI_00001_.png",
              subfolder: "",
              type: "output",
              url: "/view?filename=ComfyUI_00001_.png&subfolder=&type=output"
            }
          ]
        }
      },
      status: {
        status_str: "success",
        completed: true
      }
    }
  },
  requestId: 'exec-1'
}
```

**失败响应：**
```javascript
{
  type: 'comfy-pilot:execution-result',
  payload: {
    success: false,
    error: '错误信息',
    promptId: 'abc123-...'
  },
  requestId: 'exec-1'
}
```

#### 6. 工作流变化通知（自动推送）

当工作流发生变化时，插件会自动推送通知（无需请求）：

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'comfy-pilot:workflow-graph-changed') {
    console.log('工作流已变化:', event.data.payload);
  }
});
```

**推送消息格式：**
```javascript
{
  type: 'comfy-pilot:workflow-graph-changed',
  payload: { /* 完整的工作流数据 */ },
  timestamp: 1234567890
}
```

**触发时机：** 加载工作流、配置工作流、用户手动修改后

## 💡 使用示例

### 示例 1：简单的执行工作流

```javascript
const iframe = document.getElementById('comfyui');

// 监听响应
window.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'comfy-pilot:execution-result') {
    if (payload.success) {
      console.log('执行成功！');

      // 获取第一张图片
      const outputs = payload.outputs.outputs;
      for (const nodeOutput of Object.values(outputs)) {
        if (nodeOutput.images?.[0]) {
          const img = nodeOutput.images[0];
          const imageUrl = `http://localhost:8188${img.url}`;
          console.log('生成的图片:', imageUrl);
          break;
        }
      }
    } else {
      console.error('执行失败:', payload.error);
    }
  }
});

// 执行工作流
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:execute-workflow',
  requestId: 'exec-' + Date.now()
}, '*');
```

### 示例 2：封装的客户端类

```javascript
class ComfyUIClient {
  constructor(iframeElement) {
    this.iframe = iframeElement;
    this.pendingRequests = new Map();
    window.addEventListener('message', (e) => this.handleMessage(e));
  }

  sendRequest(type, payload = null) {
    return new Promise((resolve, reject) => {
      const requestId = `${type}-${Date.now()}`;
      this.pendingRequests.set(requestId, { resolve, reject });
      this.iframe.contentWindow.postMessage({ type, payload, requestId }, '*');

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('请求超时'));
        }
      }, 30000);
    });
  }

  handleMessage(event) {
    const { type, payload, requestId } = event.data || {};
    if (!type?.startsWith('comfy-pilot:')) return;
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      resolve(payload);
    }
  }

  async executeWorkflow(batchCount = 1) {
    return this.sendRequest('comfy-pilot:execute-workflow', { batchCount });
  }
}

// 使用
const client = new ComfyUIClient(document.getElementById('comfyui'));
const result = await client.executeWorkflow();
```

### 示例 3：处理执行输出

```javascript
async function executeAndGetImages(client) {
  const result = await client.executeWorkflow();

  if (!result.success) {
    throw new Error(result.error);
  }

  // 提取所有图片
  const images = [];
  const outputs = result.outputs.outputs;

  for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
    if (nodeOutput.images) {
      nodeOutput.images.forEach(img => {
        images.push({
          nodeId,
          filename: img.filename,
          url: `http://localhost:8188${img.url}`
        });
      });
    }
  }

  return images;
}

// 使用
const images = await executeAndGetImages(client);
images.forEach(img => {
  console.log(`节点 ${img.nodeId}: ${img.url}`);
});
```

## ⚠️ 注意事项

### 1. 安全性
- 生产环境建议使用具体的 origin 而不是 `'*'`
- 验证消息来源：`if (event.origin !== 'https://your-domain.com') return;`

### 2. 跨域问题
- 如果前端和 ComfyUI 不在同一域名，需要配置 CORS
- 图片 URL 访问可能需要处理跨域

### 3. 超时设置
- 执行超时时间为 5 分钟（300000ms）
- 复杂工作流可能需要更长时间，建议在客户端实现重试机制

### 4. requestId 管理
- 每个请求必须使用唯一的 requestId
- 建议格式：`${type}-${timestamp}-${random}`

### 5. 输出文件路径
- 输出文件默认保存在 `ComfyUI/output/` 目录
- URL 是相对路径，需要拼接服务器地址

## 📚 API 参考表

### 请求消息类型

| 消息类型 | 说明 | 必需参数 | 可选参数 |
|---------|------|---------|---------|
| `comfy-pilot:ping` | 检测插件状态 | `requestId` | - |
| `comfy-pilot:get-workflow` | 获取当前工作流 | `requestId` | - |
| `comfy-pilot:set-workflow` | 设置工作流内容 | `requestId`, `payload` | - |
| `comfy-pilot:new-workflow` | 创建新工作流 | `requestId` | - |
| `comfy-pilot:execute-workflow` | 执行工作流 | `requestId` | `payload.batchCount` |

### 响应消息类型

| 消息类型 | 说明 | 返回字段 |
|---------|------|---------|
| `comfy-pilot:pong` | 状态响应 | `version` |
| `comfy-pilot:workflow-data` | 工作流数据 | 完整工作流对象 |
| `comfy-pilot:workflow-set` | 设置成功 | `success: true` |
| `comfy-pilot:workflow-created` | 创建成功 | `success: true` |
| `comfy-pilot:execution-result` | 执行结果 | `success`, `promptId`, `outputs`, `error?` |
| `comfy-pilot:workflow-graph-changed` | 工作流变化（自动推送） | 完整工作流对象 |
| `comfy-pilot:error` | 错误响应 | `message` |

## 📦 输出格式说明

### 执行输出结构

```javascript
{
  promptId: "abc123-def456-...",
  outputs: {
    "9": {  // 节点 ID
      images: [
        {
          filename: "ComfyUI_00001_.png",
          subfolder: "",
          type: "output",
          url: "/view?filename=..."
        }
      ]
    }
  },
  status: {
    status_str: "success",
    completed: true
  }
}
```

### 支持的输出类型

- **images**: 图片文件（PNG、JPG 等）
- **videos**: 视频文件（MP4、AVI 等）
- **gifs**: GIF 动画
- **audio**: 音频文件（WAV、MP3 等）

详细的输出格式说明请参考：[docs/OUTPUT_FORMAT.md](docs/OUTPUT_FORMAT.md)

## 🔧 故障排查

### 问题 1：插件未加载

**症状：** 控制台没有看到 `[Comfy Pilot Bridge] 已启用` 消息

**解决方案：**
1. 确认插件在 `custom_nodes/comfy-pilot-plugin` 目录
2. 重启 ComfyUI
3. 检查浏览器控制台是否有错误信息

### 问题 2：执行失败 - widget_idx_map 错误

**症状：** `Cannot set properties of undefined (setting 'widget_idx_map')`

**解决方案：** 此问题已在最新版本修复，确保使用最新代码

### 问题 3：无法获取输出

**症状：** `outputs` 字段为 `null` 或 `outputError`

**解决方案：**
1. 检查工作流是否包含输出节点（如 SaveImage）
2. 确认执行确实成功完成
3. 检查 `promptId` 是否有效

### 问题 4：跨域访问图片失败

**症状：** 无法加载图片 URL

**解决方案：**
1. 配置 ComfyUI 的 CORS 设置
2. 使用代理服务器转发请求
3. 确保前端和 ComfyUI 在同一域名

## 📁 项目结构

```
comfy-pilot-plugin/
├── __init__.py              # 插件入口
├── web/
│   └── js/
│       └── postmessage_bridge.js  # 前端通信桥接
├── docs/
│   └── OUTPUT_FORMAT.md     # 输出格式详细说明
└── README.md                # 本文档
```

## 🔍 技术细节

### 通信机制
- 基于浏览器原生 PostMessage API
- 支持 iframe 跨域通信
- 请求-响应模式，通过 requestId 追踪

### 执行流程
1. 调用 `app.queuePrompt()` 提交工作流到执行队列
2. 监听 `execution_success` 和 `execution_error` 事件
3. 执行完成后通过 `api.getHistory()` 获取输出
4. 格式化输出数据并构建访问 URL
5. 通过 PostMessage 返回结果

### 自动推送机制
- 拦截 `app.graph.configure` 方法
- 拦截 `app.loadGraphData` 方法
- 工作流变化后延迟 100ms 推送（防抖）

## 📝 更新日志

### v2.1.0 (最新)
- ✅ 修复执行工作流时的 `widget_idx_map` 错误
- ✅ 新增自动获取执行输出功能
- ✅ 支持多种输出类型（图片、视频、GIF、音频）
- ✅ 自动构建资源访问 URL
- ✅ 添加执行超时保护（5分钟）
- ✅ 完善错误处理机制

### v2.0.0
- ✅ 基础工作流管理功能
- ✅ 工作流执行控制
- ✅ 自动推送工作流变化
- ✅ PostMessage 通信机制

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南
1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 📄 相关文档

- [输出格式详细说明](docs/OUTPUT_FORMAT.md)
- [ComfyUI 官方文档](https://github.com/comfyanonymous/ComfyUI)

## 📧 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发起 Discussion

## 📜 许可证

本项目采用 MIT 许可证。

---

**版本：** v2.1.0
**最后更新：** 2026-01-21
**兼容 ComfyUI 版本：** v0.7.0+

