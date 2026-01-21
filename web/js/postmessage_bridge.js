import {app} from "../../../scripts/app.js";
import {api} from "../../../scripts/api.js";

app.registerExtension({
    name: "ComfyPilot.PostMessageBridge",

    async setup() {
        console.log("[Comfy Pilot Bridge] 初始化中...");

        const notifyWorkflowChange = function (workflow) {
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'comfy-pilot:workflow-graph-changed',
                    payload: workflow,
                    timestamp: Date.now()
                }, '*');
            }
        };

        // 监听图变化
        const originalGraphConfigure = app.graph.configure;
        app.graph.configure = function (...args) {
            const returnVal = originalGraphConfigure.call(app.graph, ...args);
            setTimeout(() => {
                const currentWorkflow = app.graph.serialize();
                notifyWorkflowChange(currentWorkflow);
            }, 100);
            return returnVal;
        };

        const originalLoadGraphData = app.loadGraphData;
        app.loadGraphData = function (...args) {
            const returnVal = originalLoadGraphData.call(app, ...args);
            setTimeout(() => {
                const currentWorkflow = app.graph.serialize();
                notifyWorkflowChange(currentWorkflow);
            }, 100);
            return returnVal;
        }

        // 监听外部消息
        window.addEventListener('message', (event) => {
            const {type, payload, requestId} = event.data || {};
            if (!type || !type.startsWith('comfy-pilot:')) return;

            try {
                switch (type) {
                    case 'comfy-pilot:get-workflow':
                        this.handleGetWorkflow(event, requestId);
                        break;
                    case 'comfy-pilot:set-workflow':
                        this.handleSetWorkflow(event, payload, requestId);
                        break;
                    case 'comfy-pilot:execute-workflow':
                        this.handleExecuteWorkflow(event, payload, requestId);
                        break;
                    case 'comfy-pilot:ping':
                        this.handlePing(event, requestId);
                        break;
                    case 'comfy-pilot:new-workflow':
                        this.handleNewWorkflow(event, requestId);
                        break;
                }
            } catch (error) {
                console.error('[Comfy Pilot Bridge] 错误:', error);
                this.sendError(event, error.message, requestId);
            }
        });

        console.log("[Comfy Pilot Bridge] 已启用");
    },

    handleGetWorkflow(event, requestId) {
        const workflow = app.graph.serialize();
        this.sendResponse(event, 'comfy-pilot:workflow-data', workflow, requestId);
    },

    handleSetWorkflow(event, payload, requestId) {
        if (!payload) {
            throw new Error('缺少工作流数据');
        }
        app.graph.configure(payload);
        this.sendResponse(event, 'comfy-pilot:workflow-set', {success: true}, requestId);
    },

    async handleExecuteWorkflow(event, payload, requestId) {
        if (!requestId) {
            throw new Error('执行工作流需要 requestId');
        }

        try {
            // 使用 app.queuePrompt() 而不是直接调用 api.queuePrompt()
            // app.queuePrompt() 会处理所有必要的上下文和元数据
            await app.queuePrompt(0, payload?.batchCount || 1);

            // 监听执行结果
            // 注意：app.queuePrompt() 不直接返回 promptId，需要通过事件监听
            this.monitorLatestExecution(event, requestId);
        } catch (error) {
            this.sendResponse(event, 'comfy-pilot:execution-result', {
                success: false,
                error: error.message
            }, requestId);
        }
    },

    monitorLatestExecution(event, requestId) {
        // 监听最新的执行结果（不依赖 promptId）
        let hasResponded = false;
        const timeout = setTimeout(() => {
            if (!hasResponded) {
                cleanup();
                this.sendResponse(event, 'comfy-pilot:execution-result', {
                    success: false,
                    error: '执行超时'
                }, requestId);
            }
        }, 300000); // 5分钟超时

        const successHandler = async (e) => {
            if (!hasResponded) {
                hasResponded = true;
                cleanup();

                const promptId = e.detail?.prompt_id;

                // 获取执行输出
                try {
                    const outputs = await this.getExecutionOutputs(promptId);
                    this.sendResponse(event, 'comfy-pilot:execution-result', {
                        success: true,
                        promptId,
                        outputs
                    }, requestId);
                } catch (error) {
                    this.sendResponse(event, 'comfy-pilot:execution-result', {
                        success: true,
                        promptId,
                        outputs: null,
                        outputError: error.message
                    }, requestId);
                }
            }
        };

        const errorHandler = (e) => {
            if (!hasResponded) {
                hasResponded = true;
                cleanup();
                this.sendResponse(event, 'comfy-pilot:execution-result', {
                    success: false,
                    error: e.detail?.exception_message || '执行失败',
                    promptId: e.detail?.prompt_id
                }, requestId);
            }
        };

        const cleanup = () => {
            clearTimeout(timeout);
            api.removeEventListener('execution_success', successHandler);
            api.removeEventListener('execution_error', errorHandler);
        };

        api.addEventListener('execution_success', successHandler);
        api.addEventListener('execution_error', errorHandler);
    },

    async getExecutionOutputs(promptId) {
        if (!promptId) {
            throw new Error('缺少 promptId');
        }

        // 通过 History API 获取执行结果
        const history = await api.getHistory(promptId);

        if (!history || !history[promptId]) {
            throw new Error('未找到执行历史');
        }

        const execution = history[promptId];
        const outputs = execution.outputs || {};

        // 格式化输出，构建完整的图片 URL
        const formattedOutputs = {};

        for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
            formattedOutputs[nodeId] = {};

            // 处理图片输出
            if (nodeOutput.images) {
                formattedOutputs[nodeId].images = nodeOutput.images.map(img => ({
                    filename: img.filename,
                    subfolder: img.subfolder || '',
                    type: img.type || 'output',
                    // 构建完整的访问 URL
                    url: `/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`
                }));
            }

            // 处理其他类型的输出（视频、音频等）
            if (nodeOutput.gifs) {
                formattedOutputs[nodeId].gifs = nodeOutput.gifs;
            }
            if (nodeOutput.videos) {
                formattedOutputs[nodeId].videos = nodeOutput.videos;
            }
            if (nodeOutput.audio) {
                formattedOutputs[nodeId].audio = nodeOutput.audio;
            }
        }

        return {
            promptId,
            outputs: formattedOutputs,
            status: execution.status
        };
    },

    monitorExecution(event, promptId, requestId) {
        const handler = (e) => {
            const data = e.detail;

            if (data.prompt_id === promptId) {
                if (e.type === 'execution_success') {
                    this.sendResponse(event, 'comfy-pilot:execution-result', {
                        success: true,
                        promptId
                    }, requestId);
                    cleanup();
                } else if (e.type === 'execution_error') {
                    this.sendResponse(event, 'comfy-pilot:execution-result', {
                        success: false,
                        error: data.exception_message || '执行失败',
                        promptId
                    }, requestId);
                    cleanup();
                }
            }
        };

        const cleanup = () => {
            api.removeEventListener('execution_success', handler);
            api.removeEventListener('execution_error', handler);
        };

        api.addEventListener('execution_success', handler);
        api.addEventListener('execution_error', handler);
    },

    handlePing(event, requestId) {
        this.sendResponse(event, 'comfy-pilot:pong', {version: '1.0.0'}, requestId);
    },

    handleNewWorkflow(event, requestId) {
        app.loadGraphData();
        this.sendResponse(event, 'comfy-pilot:workflow-created', {success: true}, requestId);
    },

    sendResponse(event, type, payload, requestId) {
        event.source.postMessage({
            type,
            payload,
            requestId,
            timestamp: Date.now()
        }, '*');
    },

    sendError(event, message, requestId) {
        event.source.postMessage({
            type: 'comfy-pilot:error',
            payload: {message},
            requestId,
            timestamp: Date.now()
        }, '*');
    }
});