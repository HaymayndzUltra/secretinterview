<div align="right">
  <a href="#interview-assistant-中文">中文</a> | <a href="#interview-assistant-english">English</a>
</div>

# interview-assistant-中文

Interview Assistant 是一款基于 Electron 的应用，可以捕获系统音频，并提供面试中回答建议。

## 为什么是Interview Assistant

1. **实时语音转文字**: 利用 Deepgram API 实现实时语音识别。
2. **本地 LLM 回答**: 集成本地部署的 LLM 引擎（Ollama/LM Studio/vLLM），离线生成面试回答与建议，无需任何外部 API。
3. **内容管理**: 用户可以上传自己的文件，包括文本、图片和 PDF 文件，和你自己定制的提示词，可以极大的定制你想要GPT回应的风格，这些资料将用于个性化 GPT 的回答。
4. **统一上下文**: 在实时回答页面中，对话基于知识页面的配置，都在同一个上下文中进行，确保回答的连贯性和相关性。
5. **跨平台支持**: 作为 Electron 应用，可以在 Windows、macOS系统上运行。

## 演示

[Interview Assistant 演示视频](https://github.com/user-attachments/assets/3b42cc96-1b67-48e1-b40c-dbd78c328f1b)

点击上方链接查看演示视频

## 与其他工具的对比

Interview Assistant 相比其他面试辅助工具有以下优势：

1. **实时语音识别**: 利用 Deepgram API(新用户有200美元额度)，我们提供比传统语音识别更快、更准确的实时转录。
2. **个性化知识库**: 用户可以上传自己的简历、个人信息等文档，GPT 模型会基于这些信息提供更加个性化的回答建议。
3. **跨平台支持**: 作为 Electron 应用，支持 Windows、macOS。
4. **隐私保护**: 所有数据都在本地处理，不会上传到云端，保护用户的隐私信息。
5. **开源透明**: 我的代码完全开源，可以自由查看、修改和贡献。

下面是 Interview Assistant 与其他面试辅助工具的功能对比表：

|                                                      | Windows | Mac  | 个性定制prompt/上传个人文件 |
| ---------------------------------------------------- | ------- | ---- | ----------- |
| [cheetah](https://github.com/leetcode-mafia/cheetah) |         | ✅    |             |
| [ecoute](https://github.com/SevaSk/ecoute)           | ✅       |      |             |
| Interview Copilot                                    | ✅       | ✅    | ✅          |


这个对比表格清晰地展示了 Interview Assistant 相比其他工具的优势，特别是跨平台和定制prompt。

## 安装和使用

1. 从 Release 页面下载适合您操作系统的安装包。
2. 运行 Interview Assistant。
3. 在设置页面配置本地 LLM 服务（模型、URL 等）以及可选的 Deepgram 备用密钥。
4. 开始使用实时面试辅助功能或管理您的知识库。

## 配置说明

要使用 Interview Assistant，您需要：

1. 本地 LLM 服务: 确保 Ollama、LM Studio 或兼容的 HTTP 接口正在运行，并在设置中配置 Base URL、模型名称等参数。
2. Deepgram API 密钥（可选）: 作为本地语音识别的备用方案，可访问 https://deepgram.com 注册获取。
3. 知识库分层: `knowledge/permanent` 下的 Markdown 提供固定人格与流程，`knowledge/projects/current_project.md` 保存当前项目上下文，可按项目替换。

![image-20240919163506505](https://cdn.jsdelivr.net/gh/filifili233/blogimg@master/uPic/image-20240919163506505.png)

## 开发

本项目基于 Electron 和 React 开发。请按以下步骤操作：

1. 克隆仓库: `git clone https://github.com/nohairblingbling/Interview-Assistant`
2. 安装依赖: `npm install`
3. 安装 Electron: `npm install electron`
4. 启动开发服务器: `npm start`
5. 构建应用: `npm run make`

## 许可证

本项目采用 MIT 许可证。详情请见 LICENSE 文件。

---

# interview-assistant-english

Interview Assistant is an Electron-based application that captures system audio (online meetings) and provides real-time interview response suggestions.

## Why Interview Assistant

1. **Real-time Speech-to-Text**: Runs a local GPU-accelerated Whisper/ASR engine for sub-300&nbsp;ms streaming transcription and automatically falls back to Deepgram only when the local engine is unavailable.
2. **Local LLM Responses**: Integrates an offline LLM engine (Ollama/LM Studio/vLLM compatible) to provide instant, intelligent interview guidance without any external APIs.
3. **Content Management**: Users can upload their own files, including text, images, and PDF files, along with customized prompts, greatly customizing the style of GPT responses. These materials will be used to personalize GPT's answers.
4. **Unified Context**: In the real-time response page, conversations are based on the knowledge page configuration, all within the same context, ensuring coherence and relevance of answers.
5. **Cross-platform Support**: As an Electron application, it can run on Windows and macOS systems.

## Demo

[Interview Assistant Demo Video](https://github.com/user-attachments/assets/3b42cc96-1b67-48e1-b40c-dbd78c328f1b)

Click the link above to view the demo video

## Comparison with Other Tools

Interview Assistant has the following advantages compared to other interview assistance tools:

1. **Real-time Speech Recognition**: Primary transcription happens on-device with your RTX 4090 GPU. Deepgram API (new users get $200 credit) is kept as a backup if the local engine is offline.
2. **Personalized Knowledge Base**: Users can upload their own resumes, personal information, and other documents. The GPT model will provide more personalized answer suggestions based on this information.
3. **Cross-platform Support**: As an Electron application, it supports Windows and macOS.
4. **Privacy Protection**: All data is processed locally and not uploaded to the cloud, protecting users' privacy.
5. **Open Source Transparency**: Our code is completely open source, free to view, modify, and contribute to.

Below is a feature comparison table of Interview Assistant with other interview assistance tools:

|                                                      | Windows | Mac | Custom prompts/Personal file upload |
| ---------------------------------------------------- | ------- | --- | ----------------------------------- |
| [cheetah](https://github.com/leetcode-mafia/cheetah) |         | ✅   |                                     |
| [ecoute](https://github.com/SevaSk/ecoute)           | ✅       |     |                                     |
| Interview Copilot                                    | ✅       | ✅   | ✅                                   |

This comparison table clearly shows the advantages of Interview Assistant compared to other tools, especially in terms of cross-platform support and custom prompts.

## Installation and Usage

1. Download the installation package suitable for your operating system from the Release page.
2. Run Interview Assistant.
3. Configure your local LLM endpoint (model, base URL, options) and optional Deepgram fallback key on the settings page.
4. Start using the real-time interview assistance feature or manage your knowledge base.

## Configuration Instructions

To use Interview Assistant, you need:

1. Local LLM endpoint: Run Ollama, LM Studio, vLLM, or any OpenAI-compatible local server and provide the base URL, model name, and sampling settings.
2. Local ASR engine (recommended): Provide the path to your GPU-enabled Whisper/ASR binary and model files. The application streams 16&nbsp;kHz PCM chunks (~64&nbsp;ms) to keep end-to-end latency below 300&nbsp;ms using GPU parallel inference.
3. Deepgram API key (optional fallback): Please visit https://deepgram.com to register and obtain. New users get $200 free credit, and the homepage tutorial is simple.
4. Knowledge layers: Permanent Markdown files live in `knowledge/permanent`, while the active project context lives in `knowledge/projects/current_project.md`. Swap this file per engagement.

![image-20240919163506505](https://cdn.jsdelivr.net/gh/filifili233/blogimg@master/uPic/image-20240919163506505.png)

## Development

This project is developed based on Electron and React. Please follow these steps:

1. Clone the repository: `git clone https://github.com/nohairblingbling/Interview-Assistant`
2. Install dependencies: `npm install`
3. Install Electron: `npm install electron`
4. Start the development server: `npm start`
5. Build the application: `npm run make`

## License

This project is licensed under the MIT License. See the LICENSE file for details.