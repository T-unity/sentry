package main

import (
    "encoding/json"
    "errors"
    "fmt"
    "log"
    "math/rand"
    "os"
    "time"

    "github.com/getsentry/sentry-go"
)

func main() {
    err := sentry.Init(sentry.ClientOptions{
        Dsn:              "https://5446d1adb4536d230c2164b75b9de107@o4508539131265024.ingest.us.sentry.io/4508539236319232",
        TracesSampleRate: 1.0,
    })
    if err != nil {
        log.Fatalf("sentry.Init: %s", err)
    }
    defer sentry.Flush(2 * time.Second)

    // メインのエラー処理
    if err := foo(); err != nil {
        randStr := randomString(8)
        sentry.WithScope(func(scope *sentry.Scope) {
            // フィンガープリントが変化するのでエラーが重複せず複数上がりやすい
            scope.SetFingerprint([]string{"my-unique-error", randStr})
            sentry.CaptureException(err)
        })
    }
}

// fooでは、複数の「やや複雑な」エラー発生パターンを試す
func foo() error {
    // 1) シミュレート関数で複数エラー要因を生成
    if err := simulateComplexError(); err != nil {
        return fmt.Errorf("foo() failed due to complex error: %w", err)
    }
    // 2) さらに bar() も呼び出し (既存ロジック)
    return bar()
}

func bar() error {
    return baz()
}

func baz() error {
    now := time.Now().Format(time.RFC3339)
    r := randomString(8)
    // 既存のランダム文字列を使ったエラー
    return errors.New(fmt.Sprintf("%s_%s", r, now))
}

// simulateComplexError は複数のエラー要因をランダムに発生させる
func simulateComplexError() error {
    // ランダムでどのエラーを起こすか
    n := rand.Intn(3)
    switch n {
    case 0:
        return simulatePanicInGoroutine()
    case 1:
        return simulateJSONError()
    default:
        return simulateConfigError()
    }
}

// simulatePanicInGoroutine: goroutine内でpanicを起こし、recoverしてエラー化する
func simulatePanicInGoroutine() error {
    ch := make(chan error, 1)

    go func() {
        defer func() {
            if r := recover(); r != nil {
                // panicをエラーにしてチャンネルに送る
                ch <- fmt.Errorf("goroutine panic recovered: %v", r)
            }
        }()
        // ランダムなpanic
        panic(fmt.Sprintf("something went horribly wrong (rand=%d)", rand.Intn(9999)))
    }()

    // goroutineの終了待ち
    err := <-ch
    return err
}

// simulateJSONError: 不正なJSON文字列をパースしてエラーを発生させる
func simulateJSONError() error {
    invalidJSON := `{"name": "test", "age": ??? }` // ??? でパースエラー
    var data map[string]interface{}

    if err := json.Unmarshal([]byte(invalidJSON), &data); err != nil {
        return fmt.Errorf("JSON parse error: %w", err)
    }
    return nil
}

// simulateConfigError: 環境変数 MY_CONFIG が設定されていなければエラーにする
func simulateConfigError() error {
    val := os.Getenv("MY_CONFIG")
    if val == "" {
        return errors.New("missing MY_CONFIG environment variable")
    }
    return nil
}

// randomString: ランダムな文字列を返す
func randomString(n int) string {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    rand.Seed(time.Now().UnixNano())
    b := make([]byte, n)
    for i := 0; i < n; i++ {
        b[i] = letters[rand.Intn(len(letters))]
    }
    return string(b)
}