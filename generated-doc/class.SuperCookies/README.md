# `class` SuperCookies `extends` Map\<`string`, `string`>

[Documentation Index](../README.md)

```ts
import {SuperCookies} from "jsr:@shaulov/super-request@0.1.3"
```

A Cookies implementation that can parse and set cookies in HTTP headers.
This object can be constructed from the "Cookie" header of an HTTP request.
Then it can be used to get, set, and delete cookies.
Then you can apply the changes to the "Set-Cookie" headers of an HTTP response by calling the [applyToResponse()](../class.SuperCookies/README.md#-applytoresponseresponse-headers-headers--headersinit-void) method.

## This class has

- [constructor](#-constructorcookieheader-string--null)
- 3 methods:
[set](#-override-setname-string-value-string-options-cookieoptions-this),
[delete](#-override-deletekey-string-boolean),
[applyToResponse](#-applytoresponseresponse-headers-headers--headersinit-void)
- base class


#### 🔧 `constructor`(cookieHeader?: `string` | `null`)

> Creates a Cookies object by parsing the given "Cookie" header.
> 
> 🎚️ Parameter **cookieHeader**:
> 
> The value of the "Cookie" header from an HTTP request.



#### ⚙ `override` set(name: `string`, value: `string`, options?: [CookieOptions](../type.CookieOptions/README.md)): `this`

> Sets a cookie value with optional parameters.
> 
> Setting a cookie with an empty value will result in deleting it.
> 
> Default path option is "/".
> 
> 🎚️ Parameter **name**:
> 
> The cookie name.
> 
> 🎚️ Parameter **value**:
> 
> The cookie value.
> 
> 🎚️ Parameter **options**:
> 
> Optional cookie parameters (expires, maxAge, domain, path, secure, httpOnly, sameSite).



#### ⚙ `override` delete(key: `string`): `boolean`



#### ⚙ applyToResponse(response: \{headers?: Headers | HeadersInit}): `void`

> Applies the cookie changes to the given HTTP response headers.
> 
> 🎚️ Parameter **response**:
> 
> An object containing the HTTP response headers. If the `headers` property is not present, it will be created.



