# `class` SuperBlob `extends` Blob

[Documentation Index](../README.md)

```ts
import {SuperBlob} from "jsr:@shaulov/super-request@0.1.7"
```

A Blob implementation that uses a ReadableStream as the data source.

## This class has

- [constructor](#-constructorbody-rdstream--readablestreamuint8arrayarraybuffer-type-string)
- 5 methods:
[stream](#-override-stream-readablestreamuint8arrayarraybuffer),
[arrayBuffer](#-override-arraybuffer-promiseany),
[bytes](#-override-bytes-any),
[text](#-override-text-any),
[slice](#-override-slicestart-number-end-number-contenttype-string-superblob)
- base class


#### 🔧 `constructor`(body: [RdStream](../class.RdStream/README.md) | ReadableStream\<Uint8Array\<ArrayBuffer>>, type: `string`)



#### ⚙ `override` stream(): ReadableStream\<Uint8Array\<ArrayBuffer>>



#### ⚙ `override` arrayBuffer(): Promise\<`any`>



#### ⚙ `override` bytes(): `any`



#### ⚙ `override` text(): `any`



#### ⚙ `override` slice(start?: `number`, end?: `number`, contentType?: `string`): [SuperBlob](../class.SuperBlob/README.md)



