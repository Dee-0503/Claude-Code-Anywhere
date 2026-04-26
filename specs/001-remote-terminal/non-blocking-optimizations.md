# Non-blocking Optimization Backlog: Remote Terminal

用于阶段完成后整体评估，不阻塞当前 US7 PR 合并。

| ID      | Area                      | Suggestion                                                                                                   | Why                                                                                       | Suggested evaluation point                                       |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| NBO-001 | Terminal scaling          | Replace hardcoded `characterWidth: 8` in `TerminalView` with measured or configurable xterm character width. | Different fonts, zoom levels, and platforms may make fixed width inaccurate.              | After US7/US8 completion, before final polish/performance pass.  |
| NBO-002 | Terminal output rendering | Replace 1MB fallback text string concat/slice with chunked or ring-buffer-backed text storage.               | High-frequency output may make repeated O(n) string operations visible on slower devices. | During final performance validation with large-output scenarios. |
