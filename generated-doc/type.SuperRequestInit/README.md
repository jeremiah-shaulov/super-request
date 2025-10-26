# `type` SuperRequestInit

[Documentation Index](../README.md)

```ts
import {SuperRequestInit} from "jsr:@shaulov/super-request@0.1.5"
```

Initialization options for SuperRequest, extending standard RequestInit and accepting SuperBodyInit for the body.

`type` SuperRequestInit = Omit\<RequestInit, <mark>"body"</mark>> \& \{body?: [SuperBodyInit](../private.type.SuperBodyInit/README.md) | `null`}