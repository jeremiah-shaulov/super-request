# `class` SuperRequest `extends` Request

[Documentation Index](../README.md)

```ts
import {SuperRequest} from "jsr:@shaulov/super-request@0.1.8"
```

This class extends the standard Request class to add additional features.
It can be constructed from an existing Request object or any other way like the standard Request.
It also supports `Reader` body type in the constructor (objects that have a `read(buffer)` method, like `Deno.FsFile`).
Such body type is more efficient, because it doesn't require copying data into intermediate buffers.

The additional features are:
- Maximum request body size limit, configurable via the `SuperRequestOptions.lengthLimitlengthLimit` option.
If the request body exceeds this limit, the body stream is cancelled, and a [TooBigError](../class.TooBigError/README.md) is thrown.
- [urlUrl](../class.SuperRequest/README.md#-get-urlurl-superurl) property: a [SuperUrl](../class.SuperUrl/README.md) object representing the request URL.
- [type](../class.SuperRequest/README.md#-get-type-string) and [charset](../class.SuperRequest/README.md#-get-charset-string) properties: parsed values from the "Content-Type" header.
- [cookies](../class.SuperRequest/README.md#-get-cookies-supercookies) property: a [SuperCookies](../class.SuperCookies/README.md) object representing the cookies in the "Cookie" header. You can add, modify, and delete cookies, and then apply the changes to a `Response` object.
- [files()](../class.SuperRequest/README.md#-files-asyncgeneratorname-string-value-file-void-unknown) method: an async generator that yields files from a "multipart/form-data" request body. The file streams are not kept in memory, and you need to consume or cancel each file stream during the iteration.
- [formData()](../class.SuperRequest/README.md#-override-formdata-promiseformdata) method behaves differently than the standard `Request`: it returns a `FormData` object that includes only non-file fields from a "multipart/form-data" body. File fields are skipped. If you're interested in files, call the [files()](../class.SuperRequest/README.md#-files-asyncgeneratorname-string-value-file-void-unknown) method before calling [formData()](../class.SuperRequest/README.md#-override-formdata-promiseformdata) to handle the files.
- [json()](../class.SuperRequest/README.md#-override-json-promiseany) method: parses the request body as JSON. Unlike the standard `Request`, it can also parse "multipart/form-data" and "application/x-www-form-urlencoded" bodies into a JavaScript object. The parsing rules are the same as for [SuperUrl](../class.SuperUrl/README.md) search parameters, supporting arrays and nested objects.

## This class has

- [constructor](#-constructorinput-requestinfo--url-init-superrequestinit-options-superrequestoptions)
- 7 properties:
[body](#-override-get-body-readablestreamuint8arrayarraybuffer),
[bodyUsed](#-override-get-bodyused-boolean),
[url](#-override-get-url-string),
[urlUrl](#-get-urlurl-superurl),
[type](#-get-type-string),
[charset](#-get-charset-string),
[cookies](#-get-cookies-supercookies)
- 7 methods:
[files](#-files-asyncgeneratorname-string-value-file-void-unknown),
[json](#-override-json-promiseany),
[formData](#-override-formdata-promiseformdata),
[bytes](#-override-bytes-promiseuint8arrayarraybuffer),
[arrayBuffer](#-override-arraybuffer-promisearraybuffer),
[text](#-override-text-promiseany),
[blob](#-override-blob-promisesuperblob)
- base class


#### 🔧 `constructor`(input: RequestInfo | URL, init?: [SuperRequestInit](../type.SuperRequestInit/README.md), options?: [SuperRequestOptions](../type.SuperRequestOptions/README.md))



#### 📄 `override` `get` body(): ReadableStream\<Uint8Array\<ArrayBuffer>>

> A simple getter used to expose a `ReadableStream` of the body contents.



#### 📄 `override` `get` bodyUsed(): `boolean`

> Stores a `Boolean` that declares whether the body has been used in a
> response yet.



#### 📄 `override` `get` url(): `string`

> Returns the URL of request as a string.



#### 📄 `get` urlUrl(): [SuperUrl](../class.SuperUrl/README.md)



#### 📄 `get` type(): `string`

> MIME type in lowercase, without parameters. E.g. "text/html" or "application/json".
> Empty string if "Content-Type" header is not present.



#### 📄 `get` charset(): `string`

> Charset from "Content-Type" header, e.g. "utf-8".



#### 📄 `get` cookies(): [SuperCookies](../class.SuperCookies/README.md)

> Provides access to cookies from the "Cookie" header, parsed into a SuperCookies object.
> You can read, modify, add, or delete cookies, and then apply the changes to a Response object.



#### ⚙ files(): AsyncGenerator\<\{name: `string`, value: File}, `void`, `unknown`>

> Yields file uploads from a "multipart/form-data" request body.
> 
> Each yielded object contains the field name and a File object with a readable stream.
> You must consume (read completely) or cancel each file stream before the next file can be yielded.
> This ensures efficient streaming without keeping entire files in memory.
> 
> Non-file fields are automatically collected and will be available via [formData()](../class.SuperRequest/README.md#-override-formdata-promiseformdata) or [json()](../class.SuperRequest/README.md#-override-json-promiseany) methods.
> 
> ```ts
> for await (const {name, value} of request.files())
> {	console.log(`Uploading ${value.name} to field ${name}`);
> 	using file = Deno.open('/tmp/' + value.name, {write: true, create: true});
> 	await value.stream().pipeTo(file.writable);
> }
> ```



#### ⚙ `override` json(): Promise\<`any`>

> Takes a `Response` stream and reads it to completion. It returns a promise
> that resolves with the result of parsing the body text as JSON.



#### ⚙ `override` formData(): Promise\<FormData>

> Takes a `Response` stream and reads it to completion. It returns a promise
> that resolves with a `FormData` object.



#### ⚙ `override` bytes(): Promise\<Uint8Array\<ArrayBuffer>>

> Takes a `Response` stream and reads it to completion. It returns a promise
> that resolves with a `Uint8Array`.



#### ⚙ `override` arrayBuffer(): Promise\<ArrayBuffer>

> Takes a `Response` stream and reads it to completion. It returns a promise
> that resolves with an `ArrayBuffer`.



#### ⚙ `override` text(): Promise\<`any`>

> Takes a `Response` stream and reads it to completion. It returns a promise
> that resolves with a `USVString` (text).



#### ⚙ `override` blob(): Promise\<[SuperBlob](../class.SuperBlob/README.md)>

> Takes a `Response` stream and reads it to completion. It returns a promise
> that resolves with a `Blob`.



