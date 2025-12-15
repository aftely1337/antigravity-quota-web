# 使用 Node.js 官方镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY src/ ./src/
COPY public/ ./public/

# 创建配置目录
RUN mkdir -p /app/config

# 设置环境变量
ENV PORT=3000
ENV CONFIG_DIR=/app/config

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "src/index.js"]