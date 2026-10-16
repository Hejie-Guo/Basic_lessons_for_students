# 校招生在线学习系统

这是当前局域网课程与考试网站的源代码。包含八门课程的 PDF 资料、封面、题库、考试页面、教师后台，以及可单独托管的 `share-site/` 学生静态分享页。静态页只在当前浏览器保存提交记录，没有教师后台。

## 启动

需要 Node.js 18 或更新版本，无需安装第三方依赖。

1. 复制 `data/config.example.json` 为 `data/config.json`，按需修改课程标题和评分设置。
2. 设置环境变量 `ADMIN_PASSWORD` 为自己的管理员密码。未设置密码时，教师后台无法登录。
3. 运行 `npm start`，打开 `http://localhost:3000/`。

也可用 `HOST` 与 `PORT` 指定监听地址和端口。运行后，答卷保存在本机的 `data/submissions.json`。该文件及 `data/config.json` 不纳入 Git。

运行 `npm test` 可检查课程、题库、评分和页面逻辑。

## 公开内容

本仓库包含课程资料和题库答案。公开仓库中的这些内容可被任何人查看。
