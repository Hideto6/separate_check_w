FROM node:22-alpine AS deps
WORKDIR /app

#ホストマシンから2つのファイルをコピー, node_modulesをインストール
COPY package.json package-lock.json* ./ 
RUN npm ci

# アプリケーションのビルド
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 環境変数の設定
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# 最終的な実行環境の構築
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# ユーザーとグループの作成
RUN addgroup --system --gid 1001 waritabi
RUN adduser --system --uid 1001 --ingroup waritabi waritabi

# アプリケーションのビルド成果物をコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=waritabi:waritabi /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER waritabi

EXPOSE 3000

ENV PORT 3000

# アプリケーションの起動コマンド
CMD ["npm", "start"]
