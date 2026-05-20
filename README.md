# Vocabulary Helper (词汇助手)

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## English

Vocabulary Helper is a browser extension designed to help you read English articles more efficiently. It highlights vocabulary you don't know and provides instant StarDict definitions.

### Key Features
- **StarDict Support**: Import your favorite offline dictionaries (.ifo, .idx, .dict).
- **Filtering**: Automatically filters out common words (A1-B1) and your personalized "known words" list.
- **Lemmatization**: Automatically handles word variants (e.g., "dating" maps to "date").
- **Privacy First**: All dictionary data and vocabulary lists are stored locally in your browser (IndexedDB). No data is uploaded.
- **One-Click Mark Known**: Quickly mark words as known to hide them in future readings.

### How to Install
1. **Chrome**:
   - Download the `.zip` from Release.
   - Go to `chrome://extensions/` and enable "Developer mode".
   - Click "Load unpacked" and select the extracted folder.
2. **Firefox**:
   - Download the `.xpi` (if signed) or load the temporary addon via `about:debugging`.

### How to Use
1. **Setup**: Open the extension **Options** page.
   - Upload your StarDict files.
   - (Optional) Upload your `known_words.txt`.
2. **Analyze**: Browse any English webpage and click the red **Analyze** button in the bottom right.
3. **Interact**: Hover over highlighted words to see definitions. Click **Known** to filter them out forever.

---

<a name="chinese"></a>
## 中文

Reading Helper（阅读助手）是一款智能浏览器扩展，旨在帮助您更高效地阅读英文文章。它会自动高亮您不认识的词汇，并提供即时的星际译王（StarDict）词典释义。

### 核心功能
- **支持 StarDict 词典**：支持导入您喜爱的离线词典文件（.ifo, .idx, .dict）。
- **自定义过滤**：基于您上传或标记的“已掌握”单词表进行过滤，只看您真正关心的生词。
- **词形还原**：自动识别单词变形（例如：识别 "dating" 的原形为 "date"）。
- **隐私保护**：所有词典数据和词汇表均存储在本地浏览器（IndexedDB）中，绝不上传。
- **一键标记**：快速将生词标记为“已认识”，下次阅读时不再高亮。

### 安装方法
1. **Chrome 浏览器**:
   - 从 Release 下载 `.zip` 包并解压。
   - 打开 `chrome://extensions/`，开启右上角的“开发者模式”。
   - 点击“加载已解压的扩展程序”，选择解压后的目录。
2. **Firefox 浏览器**:
   - 下载 `.xpi` 文件（签名版）或通过 `about:debugging` 临时加载。

### 使用步骤
1. **初始化**: 打开插件的 **“选项” (Options)** 页面。
   - 上传您的 StarDict 词典文件。
   - (可选) 上传您的 `known_words.txt` 词汇表。
2. **开始阅读**: 访问任意英文网页，点击右下角的红色 **Analyze** 按钮。
3. **交互**: 鼠标悬停在高亮单词上查看释义。点击 **Known** 按钮将其加入已掌握列表。

---

## Technical Details (For Developers)

This project is bootstrapped with [Plasmo](https://docs.plasmo.com/).

### Build
```bash
npm install
npm run build:chrome  # For Chrome
npm run build         # For Firefox
```
r Firefox
```
