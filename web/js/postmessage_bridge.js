import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

app.registerExtension({
    name: "ComfyPilot.PostMessageBridge",

    async setup() {
        console.log("[Comfy Pilot Bridge] 初始化中...");

        // 监听工作流变化
        this.setupWorkflowChangeListener();

        // 监听标签页切换
        this.setupTabChangeListener();

        // 监听外部消息
        window.addEventListener('message', (event) => {
            const { type, payload, requestId } = event.data || {};
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

    setupTabChangeListener() {
        const notifyTabChange = () => {
            if (window.parent !== window && app.graph) {
                try {
                    const workflow = app.graph.serialize();
                    window.parent.postMessage({
                        type: 'comfy-pilot:tab-changed',
                        payload: workflow,
                        timestamp: Date.now()
                    }, '*');
                    console.log('[Comfy Pilot Bridge] 标签页变化，工作流已推送');
                } catch (error) {
                    console.error('[Comfy Pilot Bridge] 推送工作流失败:', error);
                }
            }
        };

        if (app.ui && app.ui.tabs) {
            // 监听标签页切换
            if (app.ui.tabs.selectTab) {
                const originalSelectTab = app.ui.tabs.selectTab;
                app.ui.tabs.selectTab = (tab) => {
                    console.log("[Comfy Pilot Bridge] 标签页切换");
                    const result = originalSelectTab.call(app.ui.tabs, tab);
                    setTimeout(notifyTabChange, 100);
                    return result;
                };
            }

            // 监听标签页新增
            if (app.ui.tabs.addTab) {
                const originalAddTab = app.ui.tabs.addTab;
                app.ui.tabs.addTab = (...args) => {
                    console.log("[Comfy Pilot Bridge] 标签页新增");
                    const result = originalAddTab.apply(app.ui.tabs, args);
                    setTimeout(notifyTabChange, 100);
                    return result;
                };
            }

            // 监听标签页关闭
            if (app.ui.tabs.removeTab) {
                const originalRemoveTab = app.ui.tabs.removeTab;
                app.ui.tabs.removeTab = (tab) => {
                    console.log("[Comfy Pilot Bridge] 标签页移除");
                    const isCurrentTab = app.ui.tabs.currentTab === tab;
                    const result = originalRemoveTab.call(app.ui.tabs, tab);
                    if (isCurrentTab) {
                        setTimeout(notifyTabChange, 100);
                    }
                    return result;
                };
            }

            console.log('[Comfy Pilot Bridge] 标签页监听器已启用');
        }
    },

    setupWorkflowChangeListener() {
        let lastWorkflow = null;

        const checkAndNotify = () => {
            const currentWorkflow = app.graph.serialize();
            const currentStr = JSON.stringify(currentWorkflow);

            if (lastWorkflow !== currentStr) {
                lastWorkflow = currentStr;
                this.notifyWorkflowChange(currentWorkflow);
            }
        };

        // 监听图变化
        const originalConfigure = app.graph.configure;
        app.graph.configure = function(data) {
            originalConfigure.call(this, data);
            setTimeout(checkAndNotify, 100);
        };

        // 监听节点添加/删除
        app.graph.onNodeAdded = () => setTimeout(checkAndNotify, 100);
        app.graph.onNodeRemoved = () => setTimeout(checkAndNotify, 100);
    },

    notifyWorkflowChange(workflow) {
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'comfy-pilot:workflow-changed',
                payload: workflow,
                timestamp: Date.now()
            }, '*');
        }
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
        this.sendResponse(event, 'comfy-pilot:workflow-set', { success: true }, requestId);
    },

    async handleExecuteWorkflow(event, payload, requestId) {
        if (!requestId) {
            throw new Error('执行工作流需要 requestId');
        }

        try {
            const workflow = app.graph.serialize();
            const response = await api.queuePrompt(0, workflow);

            if (response.error) {
                throw new Error(response.error);
            }

            const promptId = response.prompt_id;
            this.monitorExecution(event, promptId, requestId);
        } catch (error) {
            this.sendResponse(event, 'comfy-pilot:execution-result', {
                success: false,
                error: error.message
            }, requestId);
        }
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
        this.sendResponse(event, 'comfy-pilot:pong', { version: '1.0.0' }, requestId);
    },

    handleNewWorkflow(event, requestId) {
        app.graph.clear();
        this.sendResponse(event, 'comfy-pilot:workflow-created', { success: true }, requestId);
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
            payload: { message },
            requestId,
            timestamp: Date.now()
        }, '*');
    }
});