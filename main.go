package main

import (
    "errors"
    "fmt"
    "log"
    "math/rand"
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

    if err := foo(); err != nil {
        randStr := randomString(8)
        sentry.WithScope(func(scope *sentry.Scope) {
            scope.SetFingerprint([]string{"my-unique-error", randStr})
            sentry.CaptureException(err)
        })
    }
}

func foo() error {
    return bar()
}

func bar() error {
    return baz()
}

func baz() error {
    now := time.Now().Format(time.RFC3339)
    r := randomString(8)
    return errors.New(fmt.Sprintf("%s_%s", r, now))
}

func randomString(n int) string {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    rand.Seed(time.Now().UnixNano())
    b := make([]byte, n)
    for i := 0; i < n; i++ {
        b[i] = letters[rand.Intn(len(letters))]
    }
    return string(b)
}