## about

sentry と github  をインテグレーションして、アプリケーションでバグが発生した際に以下を行う。
1. 自動で Github に issue を作成する。
1. AI を用いて、バグの内容を確認し、 description を生成する。
1. 最後にコミットしたコミッターにメンションをつける。

## Repeatability

### process

1. 何でもOKなので適当なアプリケーションを作成し、 localhost で起動する。
  - 今回はエラーが raise できるなら何でもOKなので、 go にしてみた。
1. Github に適当なリポジトリを作成し、push する。
1. Sentry でアカウントとプロジェクトを作成する。
  - 新規で登録すると、自動的に 14 日間のフリートライアルがスタートする。14日経過後は課金しなければならず悲しい。
1. 以下のドキュメントに従って、SentryのUI上からGithubとコネクトする。
  - https://docs.sentry.io/organization/integrations/source-code-mgmt/github/
1. Issue Alerts を作成する。
  - https://docs.sentry.io/organization/integrations/source-code-mgmt/github/#issue-management
  - ドキュメント通りに進めれば、アプリケーション上でエラー発生 → Sentry にレポーティング → 自動で Github Issue 作成 の流れが再現できる。
1. Github Actions を用意し、issue が作成されたタイミングで、エラーの分析、トリアージを行う。
