# kore-fingerprint MCP Client 配置

## Claude Desktop (stdio 模式)

**配置文件位置**：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**配置内容**（参考 `claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "kore-fingerprint": {
      "command": "node",
      "args": ["/opt/kore-fingerprint/src/main/mcp/server.mjs"],
      "env": {
        "KORE_MCP_MODE": "stdio"
      }
    }
  }
}
```

启动后 Claude Desktop 工具栏会显示 "kore-fingerprint" 服务，可用工具：
- `browser_navigate` - 导航到 URL
- `browser_screenshot` - 截图
- `browser_click` - 点击元素
- `browser_get_fingerprint` - 查看指纹

## 远程 SSE 模式（端口 39391）

适合远程 MCP 客户端（如 web 端、CLI 工具）：

```bash
# 启动
cd /opt/kore-fingerprint
KORE_MCP_MODE=sse KORE_MCP_PORT=39391 node src/main/mcp/server.mjs

# 测试
curl http://localhost:39391/health
# -> {"status":"ok","transport":"sse","sessions":0,"uptime":...}

curl http://localhost:39391/
# -> {"name":"kore-fingerprint MCP Server","version":"0.1.0",...}
```

SSE 端点：`http://<host>:39391/sse`  
POST 消息：`http://<host>:39391/messages`

## 远程调用示例（Python）

```python
import httpx
# 1. GET /sse 建立连接
# 2. 接收 endpoint URL
# 3. POST 到 endpoint URL
# (SSE 协议标准流程)
```
