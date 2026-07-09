# Claude Desktop 集成指南

kore-fingerprint 提供 **stdio** 和 **SSE** 两种 MCP 传输方式，可同时被 Claude Desktop 和其他 MCP 客户端调用。

## 方式 A: stdio 传输（推荐，最简单）

### macOS / Linux 配置

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
`~/.config/Claude/claude_desktop_config.json` (Linux)
`%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "kore-fingerprint": {
      "command": "node",
      "args": [
        "/opt/kore-fingerprint/src/main/mcp/server.mjs"
      ],
      "env": {
        "KORE_MCP_MODE": "stdio"
      }
    }
  }
}
```

或者通过 npx（如果已发布到 npm）：

```json
{
  "mcpServers": {
    "kore-fingerprint": {
      "command": "npx",
      "args": ["-y", "@kore-01/fingerprint"],
      "env": {
        "KORE_MCP_MODE": "stdio"
      }
    }
  }
}
```

### Windows 配置

```json
{
  "mcpServers": {
    "kore-fingerprint": {
      "command": "node",
      "args": [
        "C:\\Program Files\\kore-fingerprint\\resources\\app\\src\\main\\mcp\\server.mjs"
      ],
      "env": {
        "KORE_MCP_MODE": "stdio"
      }
    }
  }
}
```

## 方式 B: SSE 传输（远程服务器）

### 1. 启动 SSE 模式

```bash
KORE_MCP_MODE=sse KORE_MCP_PORT=39391 node src/main/mcp/server.mjs
```

### 2. 配置 Claude Desktop

```json
{
  "mcpServers": {
    "kore-fingerprint-remote": {
      "url": "http://43.155.130.168:39391/sse"
    }
  }
}
```

## 验证配置

### 1. 重启 Claude Desktop

macOS: 完全退出 Claude Desktop（Cmd+Q）→ 重新打开  
Windows: 任务管理器 → 结束 Claude 进程 → 重新打开  
Linux: `pkill -f claude && claude`

### 2. 检查 MCP 连接

打开 Claude Desktop → 设置 → Developer → 看到 "kore-fingerprint" 出现表示成功

### 3. 测试工具

在 Claude 中输入：

> 帮我打开 https://example.com 看看页面内容

Claude 会自动调用 `browser_navigate` 工具。

## 故障排除

### 错误: "spawn node ENOENT"

**原因**: node 不在 Claude Desktop 的 PATH 中
**解决**: 用绝对路径：

```json
{
  "command": "/usr/local/bin/node"
}
```

### 错误: "MCP SDK requires Node >=22.12"

**原因**: 系统 Node 版本过低
**解决**:

```bash
# nvm
nvm install 22
nvm use 22

# 或者
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 错误: "Failed to launch browser process: libnspr4.so"

**原因**: Chrome 系统库缺失（仅 Linux）
**解决**:

```bash
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2
```

### OCR 失败: "tesseract: command not found"

**原因**: Tesseract OCR 未装
**解决**:

```bash
# macOS
brew install tesseract tesseract-lang

# Ubuntu/Debian
sudo apt-get install -y tesseract-ocr tesseract-ocr-chi-sim

# Windows: 从 https://github.com/UB-Mannheim/tesseract/wiki 下载
```

## 高级配置

### 多 Profile 管理

kore-fingerprint 支持同时打开多个独立浏览器实例（不同指纹）：

```
用户: "用 profile-1 打开 amazon.com"
用户: "用 profile-2 打开 ebay.com"
```

每个 profile 有独立的 cookie/storage/指纹。

### 反检测配置

默认使用 puppeteer-extra-plugin-stealth，可以自定义：

```javascript
// 在 server.mjs 中添加
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin({
  enabledEvasions: new Set(['chrome-runtime', 'user-agent-override'])
}));
```

### 调试模式

启动 server 时开启 DEBUG：

```bash
DEBUG=puppeteer:* KORE_MCP_MODE=stdio node src/main/mcp/server.mjs
```

## 完整工具列表

| Tool | 描述 |
|------|------|
| `browser_navigate` | 导航到 URL |
| `browser_screenshot` | 截图（PNG/JPEG，base64 返回）|
| `browser_click` | 点击元素（CSS selector）|
| `browser_type` | 输入文本（模拟键盘或直接）|
| `browser_extract` | 提取文本/HTML |
| `browser_get_fingerprint` | 获取当前浏览器指纹 |
| `browser_solve_captcha` | 验证码识别（OCR + Vision 双引擎）|

## 参考链接

- [MCP 官方协议](https://modelcontextprotocol.io/)
- [Claude Desktop 文档](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [GitHub 仓库](https://github.com/kore-01/kore-fingerprint)
