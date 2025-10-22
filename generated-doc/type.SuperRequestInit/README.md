# `type` SuperRequestInit

[Documentation Index](../README.md)

```ts
import {SuperRequestInit} from "jsr:@shaulov/super-request@0.1.1"
```

`type` SuperRequestInit = Omit\<RequestInit, <mark>"body"</mark>> \& \{body?: [SuperBodyInit](../private.type.SuperBodyInit/README.md) | `null`}