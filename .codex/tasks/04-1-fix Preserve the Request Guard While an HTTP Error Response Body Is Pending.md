# Fix: Preserve the Request Guard While an HTTP Error Response Body Is Pending

## Problem

In `frontend/src/widgets/status/StatusWidget.tsx`, a non-2xx response immediately throws an error. The `finally` block then clears the timeout and cancellation handler, releases `outstanding`, and enables Retry.

However, `fetch()` can resolve after response headers arrive while the response body is still being transferred.

For example:

1. The server returns HTTP 503 headers.
2. The response body stalls or remains open.
3. The widget releases its request guard and enables Retry.
4. Retrying starts another request while the previous response body may still be active.

This leaves a gap in the requirement to prevent overlapping unfinished requests, particularly when cancellation is unavailable or ineffective.

This finding comes from static review; it has not yet been reproduced with a pending error-response body.

## Requested Fix

First inspect the implementation and confirm the issue.

Ensure the non-2xx path accounts for the response-body lifecycle before releasing the request guard. Receiving an HTTP error status must not, by itself, imply that the underlying operation has finished.

Preserve these behaviors:

- Display a clear HTTP failure message.
- Keep Retry disabled while the previous operation remains unresolved.
- Retain timeout and unmount cleanup.
- Do not treat calling `abort()` alone as proof of settlement.
- Prevent obsolete responses from updating the widget.
- Preserve Safari on iOS 12.5.8 compatibility.

Keep the solution local to the Status feature. Do not add shared abstractions, dependencies, polling, or unrelated changes.

## Regression Tests

Add coverage where non-2xx response headers arrive but the response body remains pending.

Verify that:

1. An HTTP failure is displayed.
2. Retry cannot start another request while the previous operation remains unresolved.
3. Timeout and unmount still perform appropriate cleanup.
4. Missing or ineffective cancellation does not permit overlapping retries.
5. Once the previous operation settles, manual retry can succeed.
6. A late completion cannot overwrite the failure state with success.

The fixture must model headers arriving separately from body completion; a fully constructed response with an already available body is insufficient for this regression.

## Completion Report

Report the confirmed cause, chosen fix, tests executed, and any remaining cancellation or recovery limitations. Do not claim target-iPad validation unless it was actually performed.