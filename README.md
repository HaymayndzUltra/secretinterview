<div align="right">
  <a href="#interview-assistant-中文">中文</a> | <a href="#interview-assistant-english">English</a>
</div>

# interview-assistant-中文

Interview Assistant 是一款基于 Electron 的应用，可以捕获系统音频，并提供面试中回答建议。

## 为什么是Interview Assistant

1. **实时语音转文字**: 利用本地 Whisper 模型实现实时语音识别。
2. **智能 GPT 回答**: 集成 OpenAI 的 GPT 模型，为面试问题提供即时、智能的回答建议。(支持带转发地址的第三方API)
3. **内容管理**: 用户可以上传自己的文件，包括文本、图片和 PDF 文件，和你自己定制的提示词，可以极大的定制你想要GPT回应的风格，这些资料将用于个性化 GPT 的回答。
4. **统一上下文**: 在实时回答页面中，对话基于知识页面的配置，都在同一个上下文中进行，确保回答的连贯性和相关性。
5. **跨平台支持**: 作为 Electron 应用，可以在 Windows、macOS系统上运行。

## 演示

[Interview Assistant 演示视频](https://github.com/user-attachments/assets/3b42cc96-1b67-48e1-b40c-dbd78c328f1b)

点击上方链接查看演示视频

## 与其他工具的对比

Interview Assistant 相比其他面试辅助工具有以下优势：

1. **实时语音识别**: 借助本地 Whisper 模型，提供更快速、更安全的实时转录，不依赖外部语音服务。
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
3. 在设置页面配置您的 OpenAI API 密钥（用于 GPT 回答）。
4. 开始使用实时面试辅助功能或管理您的知识库。

## 配置说明

要使用 Interview Assistant，您需要：

1. OpenAI API 密钥: 可以从 https://platform.openai.com 获取，或者可以购买第三方带有转发地址的API也同样支持，记得选择转发的复选框，配置完成后可以点击测试按钮进行测试。
2. Whisper.cpp 运行时：在项目根目录创建 `whisper` 文件夹（仓库已提供空目录），放置编译好的 `whisper-stream` 可执行文件以及 `models/ggml-base.en.bin`（或您喜欢的 ggml/gguf Whisper 模型）。推荐使用 whisper.cpp 仓库中的 `examples/stream` 示例（编译时启用 `--output-json-stream`），它会持续输出实时转写结果。程序会以 16kHz、16-bit PCM 的形式通过 STDIN 推送音频数据，请确保二进制支持该输入模式。打包后应用会在 `resources/whisper` 下寻找相同结构。也可以在设置页面自定义二进制和模型路径。
3. （首次运行）如需下载新的模型文件，请确保有网络连接，下载完成后即可完全离线使用。

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

1. **Real-time Speech-to-Text**: Utilizes a local Whisper model for real-time speech recognition.
2. **Intelligent GPT Responses**: Integrates OpenAI's GPT model to provide instant, intelligent answer suggestions for interview questions. (Supports third-party APIs with forwarding addresses)
3. **Content Management**: Users can upload their own files, including text, images, and PDF files, along with customized prompts, greatly customizing the style of GPT responses. These materials will be used to personalize GPT's answers.
4. **Unified Context**: In the real-time response page, conversations are based on the knowledge page configuration, all within the same context, ensuring coherence and relevance of answers.
5. **Cross-platform Support**: As an Electron application, it can run on Windows and macOS systems.

## Demo

[Interview Assistant Demo Video](https://github.com/user-attachments/assets/3b42cc96-1b67-48e1-b40c-dbd78c328f1b)

Click the link above to view the demo video

## Comparison with Other Tools

Interview Assistant has the following advantages compared to other interview assistance tools:

1. **Real-time Speech Recognition**: Using a local Whisper model, we provide faster and more private real-time transcription without relying on external APIs.
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
3. Configure your OpenAI API key on the settings page (used for GPT responses).
4. Start using the real-time interview assistance feature or manage your knowledge base.

## Configuration Instructions

To use Interview Assistant, you need:

1. OpenAI API key: Can be obtained from https://platform.openai.com, or you can purchase a third-party API with a forwarding address which is also supported. Remember to select the forwarding checkbox, and you can click the test button to test after configuration.
2. Whisper.cpp runtime: Place a compiled `whisper-stream` binary together with a `models/ggml-base.en.bin` (or another ggml/gguf Whisper checkpoint) inside the provided `whisper` directory at the project root. The recommended binary is built from the `examples/stream` target in whisper.cpp with JSON streaming enabled (`--output-json-stream`) so the app can consume incremental transcripts. The Electron bridge streams 16 kHz, 16-bit PCM audio through STDIN, so make sure the binary accepts that input mode. When packaged the app looks in `resources/whisper` for the same layout. You can override both paths from the Settings screen if you keep models elsewhere.
3. (First run only) If you need to download a new model file, ensure the machine is online. After the files are cached you can run completely offline.

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