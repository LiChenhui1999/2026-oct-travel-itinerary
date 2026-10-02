# 2026 年 10 月行程网页

静态加密网页，适合部署到 GitHub Pages。公开仓库只包含密文网页和构建脚本；原始行程及车票由 `.gitignore` 排除。

本地更新：

```sh
TRIP_PAGE_PASSWORD='你的密码' node build.mjs
```

网页使用 PBKDF2-SHA256（60 万次）和 AES-256-GCM 在浏览器本地解密。六位数字密码可以被下载密文的人离线穷举，不适合保护高敏感资料。
