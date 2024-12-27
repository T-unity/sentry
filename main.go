package main

import (
		"log"
		"time"

		"github.com/getsentry/sentry-go"
)

func main() {
		err := sentry.Init(sentry.ClientOptions{
			Dsn: "https://5446d1adb4536d230c2164b75b9de107@o4508539131265024.ingest.us.sentry.io/4508539236319232",
			// Set TracesSampleRate to 1.0 to capture 100%
			// of transactions for tracing.
			// We recommend adjusting this value in production,
			TracesSampleRate: 1.0,
		})
		if err != nil {
			log.Fatalf("sentry.Init: %s", err)
		}
		// Flush buffered events before the program terminates.
		defer sentry.Flush(2 * time.Second)

		sentry.CaptureMessage("Oooooooops!!")
}
