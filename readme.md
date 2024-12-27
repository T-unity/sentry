## about

sentry と github  をインテグレーションして、アプリケーションでバグが発生した際に以下を行う。
1. 自動で Github に issue を作成する。
1. AI を用いて、バグの内容を確認し、 description を生成する。
1. 最後にコミットしたコミッターにメンションをつける。

## Repeatability

### process

1. 何でもOKなので適当なアプリケーションを作成し、 localhost で起動する。
1. Github に適当なリポジトリを作成し、push する。
1. 
1. Sentry でアカウントとプロジェクトを作成する。
1. 
