# `type` ReaderSource

[Documentation Index](../README.md)

An object that has a `read(buffer)` method for reading data into a buffer, similar to Deno's Reader interface.
This allows using objects like `Deno.FsFile` or `Deno.TcpConn` as request body sources.
The optional `close()` method will be called when the stream is finished or cancelled.

## This type has

- 2 methods:
[read](#-readview-uint8array-number--promiselikenumber),
[close](#-close-void--promiselikevoid)


#### ⚙ read(view: Uint8Array): `number` | PromiseLike\<`number`>



#### ⚙ close?(): `void` | PromiseLike\<`void`>



