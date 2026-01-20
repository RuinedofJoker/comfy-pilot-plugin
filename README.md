# Comfy Pilot Bridge

ComfyUI PostMessage 通信桥接插件，用于 iframe 集成场景。

## 功能

- ✅ 自动监听工作流变化并推送
- ✅ 获取当前工作流 (`comfy-pilot:get-workflow`)
- ✅ 设置工作流内容 (`comfy-pilot:set-workflow`)
- ✅ 新建工作流标签页 (`comfy-pilot:new-workflow`)
- ✅ 执行工作流并返回结果 (`comfy-pilot:execute-workflow`)
- ✅ 插件状态检测 (`comfy-pilot:ping`)

## 安装

插件已在 `custom_nodes/comfy-pilot-plugin` 目录中，重启 ComfyUI 即可生效。

## 消息协议

所有消息类型以 `comfy-pilot:` 前缀开头，避免与其他插件冲突。

## 使用方法

### 1. 监听工作流变化（自动推送）

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'comfy-pilot:workflow-changed') {
    console.log('工作流已变化:', event.data.payload);
  }
});
```

### 2. 获取当前工作流

```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:get-workflow',
  requestId: 'req-001'
}, '*');

// 监听响应
window.addEventListener('message', (event) => {
  if (event.data?.type === 'comfy-pilot:workflow-data') {
    console.log('工作流:', event.data.payload);
  }
});
```

### 3. 设置工作流内容

```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:set-workflow',
  payload: workflowData,
  requestId: 'req-002'
}, '*');
```

### 4. 新建工作流标签页

```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:new-workflow',
  requestId: 'req-003'
}, '*');
```

### 5. 执行工作流

```javascript
iframe.contentWindow.postMessage({
  type: 'comfy-pilot:execute-workflow',
  requestId: 'unique-exec-id-123'
}, '*');

// 监听执行结果
window.addEventListener('message', (event) => {
  if (event.data?.type === 'comfy-pilot:execution-result') {
    const { success, error, promptId } = event.data.payload;
    const { requestId } = event.data;

    if (success) {
      console.log(`执行成功 [${requestId}]:`, promptId);
    } else {
      console.error(`执行失败 [${requestId}]:`, error);
    }
  }
});
```

## 消息类型

### 外部 → ComfyUI

| 消息类型 | 说明 | 参数 |
|---------|------|------|
| `comfy-pilot:get-workflow` | 获取当前工作流 | `requestId` |
| `comfy-pilot:set-workflow` | 设置工作流内容 | `payload`, `requestId` |
| `comfy-pilot:new-workflow` | 新建工作流标签页 | `requestId` |
| `comfy-pilot:execute-workflow` | 执行工作流 | `requestId` (必需) |
| `comfy-pilot:ping` | 检测插件状态 | `requestId` |

### ComfyUI → 外部

| 消息类型 | 说明 | 返回数据 |
|---------|------|---------|
| `comfy-pilot:workflow-changed` | 工作流变化通知（自动） | `payload`: 工作流数据 |
| `comfy-pilot:workflow-data` | 工作流数据响应 | `payload`: 工作流数据, `requestId` |
| `comfy-pilot:workflow-set` | 设置成功响应 | `payload`: `{success: true}`, `requestId` |
| `comfy-pilot:workflow-created` | 新建成功响应 | `payload`: `{success: true}`, `requestId` |
| `comfy-pilot:execution-result` | 执行结果 | `payload`: `{success, error?, promptId?}`, `requestId` |
| `comfy-pilot:pong` | 状态响应 | `payload`: `{version}`, `requestId` |
| `comfy-pilot:error` | 错误响应 | `payload`: `{message}`, `requestId` |

## 版本

v2.0.0
