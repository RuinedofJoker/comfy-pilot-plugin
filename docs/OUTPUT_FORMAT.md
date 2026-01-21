# ComfyUI 执行输出格式说明

## 1. 执行结果响应格式

当工作流执行完成后，你会收到以下格式的 postMessage 响应：

### 成功响应

```javascript
{
  type: 'comfy-pilot:execution-result',
  requestId: '你发送的请求ID',
  payload: {
    success: true,
    promptId: 'abc123-def456-...',  // 执行任务的唯一标识
    outputs: {
      // 输出数据，详见下方说明
    }
  },
  timestamp: 1234567890
}
```

### 失败响应

```javascript
{
  type: 'comfy-pilot:execution-result',
  requestId: '你发送的请求ID',
  payload: {
    success: false,
    error: '错误信息',
    promptId: 'abc123-def456-...'  // 可能为空
  },
  timestamp: 1234567890
}
```

## 2. Outputs 数据结构

`outputs` 对象按节点 ID 组织，每个节点可能包含不同类型的输出：

```javascript
{
  promptId: 'abc123-def456-...',
  outputs: {
    "9": {  // 节点 ID（SaveImage 节点）
      images: [
        {
          filename: "ComfyUI_00001_.png",
          subfolder: "",
          type: "output",
          url: "/view?filename=ComfyUI_00001_.png&subfolder=&type=output"
        },
        {
          filename: "ComfyUI_00002_.png",
          subfolder: "",
          type: "output",
          url: "/view?filename=ComfyUI_00002_.png&subfolder=&type=output"
        }
      ]
    },
    "12": {  // 另一个节点 ID
      videos: [...]
    }
  },
  status: {
    status_str: "success",
    completed: true,
    messages: [...]
  }
}
```

## 3. 输出类型

### 3.1 图片输出 (images)

```javascript
{
  images: [
    {
      filename: "ComfyUI_00001_.png",  // 文件名
      subfolder: "",                    // 子文件夹（通常为空）
      type: "output",                   // 类型：output/temp/input
      url: "/view?filename=..."         // 完整的访问 URL
    }
  ]
}
```

**访问图片：**
```javascript
// 相对 URL（需要拼接 ComfyUI 服务器地址）
const imageUrl = `http://localhost:8188${output.url}`;

// 或者手动构建
const imageUrl = `http://localhost:8188/view?filename=${output.filename}&subfolder=${output.subfolder}&type=${output.type}`;
```

### 3.2 视频输出 (videos)

```javascript
{
  videos: [
    {
      filename: "output_video.mp4",
      subfolder: "",
      type: "output"
    }
  ]
}
```

### 3.3 GIF 输出 (gifs)

```javascript
{
  gifs: [
    {
      filename: "animation.gif",
      subfolder: "",
      type: "output"
    }
  ]
}
```

### 3.4 音频输出 (audio)

```javascript
{
  audio: [
    {
      filename: "output_audio.wav",
      subfolder: "",
      type: "output"
    }
  ]
}
```

## 4. 使用示例

### 4.1 发送执行请求

```javascript
// 发送执行请求
window.postMessage({
  type: 'comfy-pilot:execute-workflow',
  requestId: 'exec-' + Date.now(),
  payload: {
    batchCount: 1  // 可选，批次数量
  }
}, '*');
```

### 4.2 接收执行结果

```javascript
window.addEventListener('message', (event) => {
  const { type, payload, requestId } = event.data;

  if (type === 'comfy-pilot:execution-result') {
    if (payload.success) {
      console.log('执行成功！');
      console.log('Prompt ID:', payload.promptId);

      // 处理输出
      const outputs = payload.outputs.outputs;

      // 遍历所有节点的输出
      for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
        console.log(`节点 ${nodeId} 的输出：`);

        // 处理图片
        if (nodeOutput.images) {
          nodeOutput.images.forEach(img => {
            console.log('图片 URL:', `http://localhost:8188${img.url}`);

            // 显示图片
            const imgElement = document.createElement('img');
            imgElement.src = `http://localhost:8188${img.url}`;
            document.body.appendChild(imgElement);
          });
        }

        // 处理视频
        if (nodeOutput.videos) {
          nodeOutput.videos.forEach(video => {
            console.log('视频文件:', video.filename);
          });
        }
      }
    } else {
      console.error('执行失败:', payload.error);
    }
  }
});
```

### 4.3 下载输出文件

```javascript
async function downloadOutput(imageUrl, filename) {
  const response = await fetch(`http://localhost:8188${imageUrl}`);
  const blob = await response.blob();

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

// 使用
downloadOutput(output.url, output.filename);
```

## 5. 常见场景

### 5.1 获取第一张生成的图片

```javascript
function getFirstImage(outputs) {
  for (const nodeOutput of Object.values(outputs.outputs)) {
    if (nodeOutput.images && nodeOutput.images.length > 0) {
      return nodeOutput.images[0];
    }
  }
  return null;
}

// 使用
const firstImage = getFirstImage(payload.outputs);
if (firstImage) {
  console.log('第一张图片:', `http://localhost:8188${firstImage.url}`);
}
```

### 5.2 获取所有图片

```javascript
function getAllImages(outputs) {
  const allImages = [];

  for (const nodeOutput of Object.values(outputs.outputs)) {
    if (nodeOutput.images) {
      allImages.push(...nodeOutput.images);
    }
  }

  return allImages;
}

// 使用
const images = getAllImages(payload.outputs);
console.log(`共生成 ${images.length} 张图片`);
```

### 5.3 按节点 ID 获取输出

```javascript
function getOutputByNodeId(outputs, nodeId) {
  return outputs.outputs[nodeId] || null;
}

// 使用
const saveImageOutput = getOutputByNodeId(payload.outputs, '9');
if (saveImageOutput && saveImageOutput.images) {
  console.log('SaveImage 节点输出:', saveImageOutput.images);
}
```

## 6. 注意事项

1. **URL 路径**：返回的 `url` 是相对路径，需要拼接 ComfyUI 服务器地址
2. **跨域问题**：如果前端和 ComfyUI 不在同一域名，需要处理 CORS
3. **文件存储**：输出文件默认保存在 `ComfyUI/output/` 目录
4. **节点 ID**：节点 ID 是工作流中定义的，不同工作流可能不同
5. **超时处理**：执行超时时间为 5 分钟，复杂工作流可能需要调整

## 7. 错误处理

```javascript
window.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  if (type === 'comfy-pilot:execution-result') {
    if (!payload.success) {
      // 执行失败
      console.error('执行错误:', payload.error);
      return;
    }

    if (payload.outputError) {
      // 获取输出失败（但执行成功）
      console.warn('获取输出失败:', payload.outputError);
      console.log('可以使用 promptId 手动获取:', payload.promptId);
      return;
    }

    // 正常处理输出
    handleOutputs(payload.outputs);
  }
});
```
