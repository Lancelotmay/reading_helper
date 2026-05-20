# Vocabulary Helper (词汇助手)

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## English

Vocabulary Helper is a browser extension designed to help you read English articles more efficiently. It highlights vocabulary you don't know and provides instant StarDict definitions.

### Key Features
- **StarDict Support**: Import your favorite offline dictionaries (.ifo, .idx, .dict).
- **Double-click Lookup**: Double-click any word on the page for an instant definition popup.
- **Filtering**: Automatically filters out common words (A1-B1) and your personalized "known words" list.
- **Lemmatization**: Automatically handles word variants (e.g., "dating" maps to "date").
- **Privacy First**: All dictionary data and vocabulary lists are stored locally in your browser (IndexedDB). No data is uploaded.
- **One-Click Mark Known**: Quickly mark words as known to hide them in future readings.

### How to Install (For Users)
Since this project is in early development, you can install it as a developer:

1. Clone or download this repository.
2. Install dependencies: `npm install`.
3. Build the extension:
   - For **Chrome/Edge**: `npm run build:chrome`
   - For **Firefox**: `npm run build`
4. Load the extension:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `build/chrome-mv3-prod` folder.
   - **Edge**: Go to `edge://extensions/`, enable "Developer mode", click "Load unpacked", and select the `build/chrome-mv3-prod` folder.
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select the `manifest.json` inside the `build/firefox-mv2-prod` folder.

### How to Use
1. **Setup**: Open the extension **Options** page.
   - Upload your StarDict files.
   - (Optional) Upload your `known_words.txt`.
2. **Analyze**: Browse any English webpage and click the red **A** button in the bottom right to highlight unknown words.
3. **Double-click**: You can also double-click any word to look it up immediately.
4. **Interact**: Hover over highlighted words to see definitions. Click **Known** to filter them out forever.

---

<a name="chinese"></a>
## 中文

Reading Helper（阅读助手）是一款智能浏览器扩展，旨在帮助您更高效地阅读英文文章。它会自动高亮您不认识的词汇，并提供即时的星际译王（StarDict）词典释义。

### 核心功能
- **支持 StarDict 词典**：支持导入您喜爱的离线词典文件（.ifo, .idx, .dict）。
- **双击查词**：在网页上双击任意单词，即可弹出即时释义。
- **自定义过滤**：基于您上传或标记的“已掌握”单词表进行过滤，只看您真正关心的生词。
- **词形还原**：自动识别单词变形（例如：识别 "dating" 的原形为 "date"）。
- **隐私保护**：所有词典数据和词汇表均存储在本地浏览器（IndexedDB）中，绝不上传。
- **一键标记**：快速将生词标记为“已认识”，下次阅读时不再高亮。

### 安装方法 (开发者/尝鲜用户)
本项目目前处于早期开发阶段，建议通过源码安装：

1. 克隆或下载本仓库代码。
2. 安装依赖：`npm install`。
3. 编译项目：
   - **Chrome/Edge**: `npm run build:chrome`
   - **Firefox**: `npm run build`
4. 加载插件：
   - **Chrome**: 访问 `chrome://extensions/`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择 `build/chrome-mv3-prod` 目录。
   - **Edge**: 访问 `edge://extensions/`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择 `build/chrome-mv3-prod` 目录。
   - **Firefox**: 访问 `about:debugging#/runtime/this-firefox`，点击“临时加载附加组件”，选择 `build/firefox-mv2-prod` 目录下的 `manifest.json` 文件。

### 使用步骤
1. **初始化**: 打开插件的 **“选项” (Options)** 页面。
   - 上传您的 StarDict 词典文件。
   - (可选) 上传您的 `known_words.txt` 词汇表。
2. **开始阅读**: 访问任意英文网页，点击右下角的红色 **A** 按钮高亮全篇生词。
3. **双击查词**: 您也可以直接双击页面上的任意单词进行即时查询。
4. **交互**: 鼠标悬停在高亮单词上查看释义。点击 **Known** 按钮将其加入已掌握列表。

---

## Technical Details (For Developers)

This project is bootstrapped with [Plasmo](https://docs.plasmo.com/).

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build:chrome  # For Chrome (MV3)
npm run build         # For Firefox (MV2)
```
